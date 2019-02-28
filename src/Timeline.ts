import * as har from 'har-format';
import m = require('mithril');
import analytics = require('./analytics');
import protocol = require('./protocol');
import { IBeaconSummary, ITimeline } from './types';
import util = require('./util');

const COLLECTOR_COLOURS = ['turquoise', 'purple', 'dark', 'red', 'yellow', 'blue', 'light'];
const SEEN_COLLECTORS = new Map();

const colourOf = (beacon: IBeaconSummary) => {
    const id = beacon.collector + beacon.appId;

    if (!SEEN_COLLECTORS.has(id)) {
        SEEN_COLLECTORS.set(id, COLLECTOR_COLOURS[SEEN_COLLECTORS.size % COLLECTOR_COLOURS.length || 0]);
    }

    return SEEN_COLLECTORS.get(id);
};

const filterRequest = (beacon: IBeaconSummary, filter?: RegExp) => {
    return typeof filter === 'undefined'
    || filter.test(beacon.appId)
    || filter.test(beacon.collector)
    || filter.test(beacon.eventName)
    || filter.test(beacon.method)
    || filter.test(beacon.page)
    || (Array.from(beacon.payload.values()) as string[]).filter((x) => {
        let decoded: string | null;
        try {
            decoded = util.b64d(x);
        } catch (e) {
            decoded = null;
        }

        return filter.test(decoded || '') || filter.test(x);
    }).length > 0
    ;
};

const nameEvent = (params: Map<string, string>): string => {
    const event = params.get('e') || 'Unknown Event';
    const eventTypes = protocol.paramMap.e.values;
    // @ts-ignore event will never be undefined.
    const result: string = eventTypes.hasOwnProperty(event) ? eventTypes[event] : event;

    switch (result) {
    case 'Self-Describing Event':
        const payload = params.get('ue_pr') || params.get('ue_px') || '';
        let sdeName = 'Unstructured';
        let sde = null;

        try {
            sde = JSON.parse(util.b64d(payload));
        } catch (e) {
            sde = JSON.parse(payload);
        } finally {
            if (typeof sde === 'object' && sde !== null && sde.hasOwnProperty('schema') && sde.hasOwnProperty('data')) {
                sdeName = sde.data.schema || 'Unstructured';
                if (sdeName.startsWith('iglu:')) {
                    sdeName = sdeName.split('/')[1];
                }
            }
        }

        return 'SD Event: ' + sdeName;
    case 'Structured Event':
        return result + ': ' + params.get('se_ca');
    default:
        return result;
    }
};

const summariseBeacons = (entry: har.Entry, index: number, filter?: RegExp): IBeaconSummary[] => {
    const reqs = extractRequests(entry, index);
    const [[id, collector, method], requests] = reqs;

    const results = [];

    for (const [i, req] of requests.entries()) {
        const result: IBeaconSummary = {
            appId: req.get('aid'),
            collector,
            eventName: nameEvent(req),
            id: `#${id}-${i}`,
            method,
            page: req.get('url'),
            payload: new Map(req),
            time: (new Date(parseInt(req.get('stm') || req.get('dtm'), 10) || +new Date())).toJSON(),
        };

        analytics.trackerAnalytics(collector, result.page, result.appId);

        if (filterRequest(result, filter)) {
            results.push(result);
        }
    }

    return results;
};

const getPageUrl = (entries: har.Entry[]) => {
    const urls = entries.reduce((ac, cv) => {
        const page = cv.request.headers.filter((x) => /referr?er/i.test(x.name))[0];
        if (page) {
            const pageVal = page.value;
            ac[pageVal] = (ac[pageVal] || 0) + 1;
        }
        return ac;
    }, {} as {[referrer: string]: number});

    let url: string | null = null;
    let max = -1;
    for (const p in urls) {
        if (urls[p] >= max) {
            url = p, max = urls[p];
        }
    }

    if (url !== null) {
        return new URL(url);
    }

    return url;
};

const extractRequests = (entry: har.Entry, index: number) => {
    const req = entry.request;
    const id = entry.pageref + util.hash(new Date(entry.startedDateTime).toJSON() + req.url + index);
    const collector = new URL(req.url).hostname;
    const method = req.method;
    const beacons = [];

    const nuid = entry.request.cookies.filter((x) => x.name === 'sp')[0];
    const ua = entry.request.headers.filter((x) => (x.name.toLowerCase() === 'user-agent'))[0];
    const lang = entry.request.headers.filter((x) => (x.name.toLowerCase() === 'accept-language'))[0];

    if (req.method === 'POST') {
        try {
            if (req.postData === undefined) {
                throw new Error('POST request unexpectedly had no body.');
            }

            const payload = JSON.parse(req.postData.text);

            for (const pl of payload.data) {
                beacons.push(new Map(Object.keys(pl).map((x): [string, string] => ([x, pl[x]]))));
                if (nuid) {
                    beacons[beacons.length - 1].set('nuid', nuid.value);
                }
                if (ua) {
                    beacons[beacons.length - 1].set('ua', ua.value);
                }
                if (lang) {
                    beacons[beacons.length - 1].set('lang', lang.value);
                }
            }

        } catch (e) {
            console.log('=================');
            console.log(e);
            console.log(JSON.stringify(req));
            console.log('=================');
        }

    } else {
        // @ts-ignore TS doesn't understand the iterable semantics here properly.
        beacons.push(new Map<string, string>(new URL(req.url).searchParams));
        if (nuid) {
            beacons[beacons.length - 1].set('nuid', nuid.value);
        }
        if (ua) {
            beacons[beacons.length - 1].set('ua', ua.value);
        }
        if (lang) {
            const langval = /^[^;,]+/.exec(lang.value);
            beacons[beacons.length - 1].set('lang', langval ? langval[0] : lang.value);
        }
    }

    return [[id, collector, method], beacons];
};

export = {
    view: (vnode: m.Vnode<ITimeline>) => {
        const url = getPageUrl(vnode.attrs.request.entries);
        return m('div.panel',
            m('p.panel-heading',
                { title: url && url.href },
                url ? url.pathname.slice(0, 34) : vnode.attrs.request.page || 'New Page',
            ),
            Array.prototype.concat.apply([], vnode.attrs.request.entries.map((x, i) => {
                const summary = summariseBeacons(x, i, vnode.attrs.filter);
                return summary.map((y) => m('a.panel-block', {
                    class: [
                        vnode.attrs.isActive(y) ? 'is-active' : '',
                        x.response.status === 200 ? '' : 'not-ok',
                        colourOf(y),
                    ].join(' '),
                    onclick: vnode.attrs.setActive.bind(null, y),
                    title: [
                        `Time: ${y.time}`,
                        `Collector: ${y.collector}`,
                        `App ID: ${y.appId}`,
                        `Status: ${x.response.status} ${x.response.statusText}`,
                    ].join('\n'),
                },
                    m('span.panel-icon', '\u26ab\ufe0f'),
                    y.eventName,
                ),
                );
            })),
        );
    },
};
