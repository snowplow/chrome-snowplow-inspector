import m = require('mithril');
import Beacon = require('./Beacon');
import protocol = require('./protocol');

const seenCollectors = {};

const trackerAnalytics = (tracker, collector, pageUrl, appId) => {
    collector = collector.toLowerCase();
    pageUrl = (new URL(pageUrl)).host.toLowerCase();
    appId = (appId || '').toLowerCase();

    const appKey = pageUrl + ':' + appId;

    if (!(collector in seenCollectors)) {
        seenCollectors[collector] = [];
    }

    if (seenCollectors[collector].indexOf(appKey) === -1) {
        seenCollectors[collector].push(appKey);

        chrome.storage.sync.get({enableTracking: true}, (settings) => {
            if (settings.enableTracking && tracker) {
                tracker.trackStructEvent('New Tracker', collector, pageUrl, appId);
            }
        });
    }
};

const summariseBeacons = (entry, index, tracker) => {
    const reqs = Beacon.extractRequests(entry, index);
    const [[id, collector, method], requests] = reqs;

    const results = [];

    let i = 0;
    for (const req of requests) {
        const result = {
            appId: req.get('aid'),
            collector,
            eventName: protocol.paramMap.e.values[req.get('e')] || req.get('e'),
            filterTag: entry.filterTag,
            id: `#${id}-${i}`,
            page: req.get('url'),
            time: (new Date(parseInt(req.get('stm') || req.get('dtm'), 10) || +new Date())).toJSON(),
        };

        trackerAnalytics(tracker, collector, result.page, result.appId);

        results.push(result);
        i++;
    }

    return results;
};

let activeLock = null;

const TimeEntry = () => {
    const sentinel = {};
    return {
        view: (vnode) => m('a', {
            class: [
                activeLock === sentinel ? 'selected' : '',
                vnode.attrs.vendor || '',
            ].join(' '),
            href: vnode.attrs.reqId,
            onclick: () => { vnode.attrs.setActive(); activeLock = sentinel; },
        },
        vnode.children),
    };
};

export = {
    view: (vnode) => {
        const urls = vnode.attrs.request.entries.reduce((ac, cv) => {
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

        return m('ol.navigationview', {
            'data-url':  url ? parsedUrl.pathname : 'New Page',
            'title': url && parsedUrl.href,
        }, Array.prototype.concat.apply([], vnode.attrs.request.entries.map((x, i) => {
            const summary = summariseBeacons(x, i, vnode.attrs.tracker);
            return summary.map((y) => m('li', {title: `Collector: ${y.collector}\nApp ID: ${y.appId}`},
                         m(TimeEntry, {
                             reqId: y.id,
                             setActive: vnode.attrs.setActive,
                             vendor: y.filterTag,
                         }, [y.eventName,
                             m('time', {datetime: y.time, title: y.time}, 'T'),
                         ]),
                    ),
                );
        })));
    },
};
