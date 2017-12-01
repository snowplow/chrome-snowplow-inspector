const m = require('mithril');
const protocol = require('./protocol');
const Beacon = require('./Beacon');

const seenCollectors = {};

function trackerAnalytics(tracker, collector, pageUrl, appId) {
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
            if (settings.enableTracking && tracker) tracker.trackStructEvent('New Tracker', collector, pageUrl, appId);
        });
    }
}

function summariseBeacons(entry, index, tracker) {
    const reqs = Beacon.extractRequests(entry, index);
    const [[id, collector, method], requests] = reqs;

    const results = [];

    let i = 0;
    for (const req of requests) {
        const result = {
            id: `#${id}-${i}`,
            eventName: protocol.paramMap['e'].values[req.get('e')] || req.get('e'),
            appId: req.get('aid'),
            collector,
            page: req.get('url'),
            time: (new Date(parseInt(req.get('stm') || req.get('dtm'), 10) || +new Date)).toJSON(),
            filterTag: entry.filterTag,
        };


        trackerAnalytics(tracker, collector, result.page, result.appId);

        results.push(result);
        i++;
    }

    return results;
}

var activeLock = null;

var TimeEntry = function(){
    const sentinel = {};
    return {
        view: (vnode) => m('a', {href: vnode.attrs.reqId, onclick: function(){vnode.attrs.setActive();activeLock = sentinel;}, class: [activeLock === sentinel ? 'selected' : '', vnode.attrs.vendor || ''].join(' ')}, vnode.children)
        };
};


export = {
    view: function(vnode){
        const urls = vnode.attrs.request.entries.reduce(function(ac, cv) {
            let url = cv.request.headers.filter((x) => /referr?er/i.test(x.name))[0];
            if (url) {
                url = url.value;
                ac[url] = (ac[url] || 0) + 1;
            }
            return ac;
        }, {});

        let url = '', parsedUrl, max = -1;
        for (const p in urls) {
            if (urls[p] >= max) url = p, max = urls[p];
        }

        if (url) parsedUrl = new URL(url);

        return m('ol.navigationview', {'data-url':  url ? parsedUrl.pathname :'New Page', title: url && parsedUrl.href}, Array.prototype.concat.apply([], vnode.attrs.request.entries.map((x, i) => {
            const summary = summariseBeacons(x, i, vnode.attrs.tracker);
            return summary.map((x) => m('li', {title: `Collector: ${x.collector}\nApp ID: ${x.appId}`},
                         m(TimeEntry, {
                             reqId: x.id,
                             vendor: x.filterTag,
                             setActive: vnode.attrs.setActive
                         }, [x.eventName,
                             m('time', {datetime: x.time, title: x.time}, 'T')
                         ])
                    ))
            }))
        );
    }
};
