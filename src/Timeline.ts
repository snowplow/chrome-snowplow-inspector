var m = require('mithril');
var protocol = require('./protocol');
var Beacon = require('./Beacon');

var seenCollectors = {};

function trackerAnalytics(tracker, collector, pageUrl, appId) {
    collector = collector.toLowerCase();
    pageUrl = (new URL(pageUrl)).host.toLowerCase();
    appId = (appId || '').toLowerCase();

    var appKey = pageUrl + ':' + appId;

    if (!(collector in seenCollectors)) {
        seenCollectors[collector] = [];
    }

    if (seenCollectors[collector].indexOf(appKey) === -1) {
        seenCollectors[collector].push(appKey);

        chrome.storage.sync.get({enableTracking: true}, function(settings) {
            if (settings.enableTracking && tracker) tracker.trackStructEvent('New Tracker', collector, pageUrl, appId);
        });
    }
}

function summariseBeacons(entry, index, tracker) {
    var requests = Beacon.extractRequests(entry, index);
    var groupId = requests[0];
    requests = requests[1];

    var results = [];

    for (var i = 0; i < requests.length; i++) {
        var result = {
            id: '#' + groupId[0] + '-' + i,
            eventName: protocol.paramMap['e'].values[requests[i].get('e')] || requests[i].get('e'),
            appId: requests[i].get('aid'),
            collector: groupId[1],
            page: requests[i].get('url'),
            time: (new Date(parseInt(requests[i].get('stm') || requests[i].get('dtm'), 10) || +new Date)).toJSON(),
            filterTag: entry.filterTag,
        };


        trackerAnalytics(tracker, result.collector, result.page, result.appId);

        results.push(result);
    }

    return results;
}

var activeLock = null;

var TimeEntry = function(){
    var sentinel = {};
    return {
        view: function(vnode){
            return m('a', {href: vnode.attrs.reqId, onclick: function(){vnode.attrs.setActive();activeLock = sentinel;}, class: [activeLock === sentinel ? 'selected' : '', vnode.attrs.vendor || ''].join(' ')}, vnode.children);
        }};
};


export = {
    view: function(vnode){
        var urls = vnode.attrs.request.entries.reduce(function(ac, cv){
            var url = cv.request.headers.filter(function(x){return /referr?er/i.test(x.name);})[0];
            if (url) {
                url = url.value;
                ac[url] = (ac[url] || 0) + 1;
            }
            return ac;
        }, {});

        var url = '', parsedUrl;
        var max = -1;
        for (var p in urls) {
            if (urls[p] >= max) url = p, max = urls[p];
        }

        if (url) parsedUrl = new URL(url);

        return m('ol.navigationview', {'data-url':  url ? parsedUrl.pathname :'New Page', title: url && parsedUrl.href}, Array.prototype.concat.apply([], vnode.attrs.request.entries.map(function(x, i){

            var summary = summariseBeacons(x, i, vnode.attrs.tracker);
            return summary.map(function(x) {
                return m('li', {title: 'Collector: ' + x.collector + '\nApp ID: ' + x.appId},
                         m(TimeEntry, {
                             reqId: x.id,
                             vendor: x.filterTag,
                             setActive: vnode.attrs.setActive
                         }, [x.eventName,
                             m('time', {datetime: x.time, title: x.time}, 'T')
                         ])
                    );
            });
        })));
    }
};
