var m = require('mithril');
var protocol = require('./protocol');
var Beacon = require('./Beacon');

var seenCollectors = {};

function trackerAnalytics(collector, pageUrl, appId) {
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
            if (settings.enableTracking && typeof sp !== 'undefined') sp.trackStructEvent('New Tracker', collector, pageUrl, appId);
        });
    }
}

function summariseBeacons(entry, index) {
    var requests = Beacon.extractRequests(entry, index);
    var groupId = requests[0];
    requests = requests[1];

    var results = [];

    for (var i = 0; i < requests.length; i++) {
        var result = {};

        result.id = '#' + groupId[0] + '-' + i;
        result.eventName = protocol.paramMap['e'].values[requests[i].get('e')] || requests[i].get('e');
        result.appId = requests[i].get('aid');
        result.collector = groupId[1];
        result.page = requests[i].get('url');
        result.time = (new Date(parseInt(requests[i].get('stm') || requests[i].get('dtm'), 10) || +new Date)).toJSON();
        result.filterTag = entry.filterTag;


        trackerAnalytics(result.collector, result.page, result.appId);

        results.push(result);
    }

    return results;
}

var activeLock = null;

var TimeEntry = function(){
    var sentinel = {};
    return {
        view: function(vnode){
            return m('a', {onclick: function(){activeLock = sentinel;}, href: vnode.attrs.reqId, class: [activeLock === sentinel ? 'selected' : '', vnode.attrs.vendor || ''].join(' ')}, vnode.children);
    }};
};


module.exports = {
    view: function(vnode){
        var urls = vnode.attrs.entries.reduce(function(ac, cv){
            var url = cv.request.headers.filter(function(x){return /referr?er/i.test(x.name)})[0];
            console.log(url);
            if (url) {
                url = url.value;
                ac[url] = (ac[url] || 0) + 1;
            }
            return ac;
        }, {});

        var url = '';
        var max = -1;
        for (var p in urls) {
            if (urls[p] >= max) url = p, max = urls[p];
        }

        if (url) url = new URL(url);

        return m('ol.navigationview', {'data-url':  url ? url.pathname :'New Page', title: url && url.href}, Array.prototype.concat.apply([], vnode.attrs.entries.map(function(x, i){

            var summary = summariseBeacons(x, i);
            return summary.map(function(x) {
                return m('li', {title: 'Collector: ' + x.collector + '\nApp ID: ' + x.appId},
                         m(TimeEntry, {
                             reqId: x.id,
                             vendor: x.filterTag,
                         }, [x.eventName,
                             m('time', {datetime: x.time, title: x.time}, 'T')
                         ])
                    );
            });
        })));
    }
};