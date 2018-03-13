import m = require('mithril');
import protocol = require('./protocol');
import util = require('./util');

const seenCollectors = {};

const trackerAnalytics = (tracker, collector, pageUrl, appId) => {
    collector = collector.toLowerCase();
    pageUrl = (new URL(pageUrl)).host.toLowerCase();
    appId = (appId || '').toLowerCase();

    const appKey = pageUrl + ':' + appId;

    if (!(collector in seenCollectors)) {
        seenCollectors[collector] = [];
    }

    if (!seenCollectors[collector].includes(appKey)) {
        seenCollectors[collector].push(appKey);

        chrome.storage.sync.get({ enableTracking: true }, (settings) => {
            if (settings.enableTracking && tracker) {
                tracker.trackStructEvent('New Tracker', collector, pageUrl, appId);
            }
        });
    }
};

const summariseBeacons = (entry, index, tracker) => {
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

        trackerAnalytics(tracker, collector, result.page, result.appId);

        results.push(result);
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
    const ua = entry.request.headers.filter((x) => x.name === 'User-Agent')[0];

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
    }

    return [[id, collector, method], beacons];
};

export = {
    view: (vnode) => {
        const url = getPageUrl(vnode.attrs.request.entries);
        return m('div.panel',
            m('p.panel-heading', { title: url && url.href }, url ? url.pathname.slice(0, 34) : 'New Page'),
            Array.prototype.concat.apply([], vnode.attrs.request.entries.map((x, i) => {
                const summary = summariseBeacons(x, i, vnode.attrs.tracker);
                return summary.map((y) => m('a.panel-block', {
                    class: vnode.attrs.isActive(y) ? 'is-active' : '',
                    onclick: vnode.attrs.setActive.bind(this, y),
                    title: `Time: ${y.time}\nCollector: ${y.collector}\nApp ID: ${y.appId}`,
                },
                    y.eventName,
                ),
                );
            })),
        );
    },
};
