import m = require('mithril');
import analytics = require('./analytics');
import protocol = require('./protocol');
import util = require('./util');

const COLLECTOR_COLOURS = ['blue', 'red', 'dark', 'green', 'yellow', 'black', 'turquoise'];
const SEEN_COLLECTORS = new Map();

const colourOf = (beacon) => {
    const id = beacon.collector + beacon.appId;

    if (!SEEN_COLLECTORS.has(id)) {
        SEEN_COLLECTORS.set(id, COLLECTOR_COLOURS[SEEN_COLLECTORS.size % COLLECTOR_COLOURS.length]);
    }

    return SEEN_COLLECTORS.get(id);
};

const filterRequest = (beacon, filter) => {
    return typeof filter === 'undefined'
    || filter.test(beacon.appId)
    || filter.test(beacon.collector)
    || filter.test(beacon.eventName)
    || filter.test(beacon.method)
    || filter.test(beacon.page)
    || Array.from(beacon.payload.values()).filter((x) => filter.test(x)).length > 0
    ;
};

const summariseBeacons = (entry, index, filter) => {
    const reqs = extractRequests(entry, index);
    const [[id, collector, method], requests] = reqs;

    const results = [];

    for (const [i, req] of Array.from(requests.entries())) {
        const result = {
            appId: req.get('aid'),
            collector,
            eventName: protocol.paramMap.e.values[req.get('e')] || req.get('e'),
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

const getPageUrl = (entries) => {
    const urls = entries.reduce((ac, cv) => {
        let page = cv.request.headers.filter((x) => /referr?er/i.test(x.name))[0];
        if (page) {
            page = page.value;
            ac[page] = (ac[page] || 0) + 1;
        }
        return ac;
    }, {});

    let url = '';
    let parsedUrl;
    let max = -1;
    for (const p in urls) {
        if (urls[p] >= max) {
            url = p, max = urls[p];
        }
    }

    if (url) {
        parsedUrl = new URL(url);
    }

    return parsedUrl || url;
};

const extractRequests = (entry, index: number) => {
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
            const payload = JSON.parse(req.postData.text);

            for (const pl of payload.data) {
                beacons.push(new Map(Object.keys(pl).map((x): [string, any] => ([x, pl[x]]))));
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
        beacons.push(new URL(req.url).searchParams);
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
    view: (vnode) => {
        const url = getPageUrl(vnode.attrs.request.entries);
        return m('div.panel',
            m('p.panel-heading', { title: url && url.href }, url ? url.pathname.slice(0, 34) : 'New Page'),
            Array.prototype.concat.apply([], vnode.attrs.request.entries.map((x, i) => {
                const summary = summariseBeacons(x, i, vnode.attrs.filter);
                return summary.map((y) => m('a.panel-block', {
                    class: [
                        vnode.attrs.isActive(y) ? 'is-active' : '',
                        x.response.status === 200 ? '' : 'not-ok',
                        colourOf(y),
                    ].join(' '),
                    onclick: vnode.attrs.setActive.bind(this, y),
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
