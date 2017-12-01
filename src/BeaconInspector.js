var m = require('mithril');
var Timeline = require('./Timeline');
var Inspector = require('./Inspector');
var Toolbar = require('./Toolbar');


var BeaconInspector = function() {
    var requests = [],
        active,
        filters = {
            'snowplow': /^[^:]+:\/\/[^/?#;]+\/(i\?(tv=|.*&tv=)|com\.snowplowanalytics\.snowplow\/tp2)/i
        };


    function checkFilters(request) {
        for (var p in filters) {
            if (filters.hasOwnProperty(p)) {
                if (filters[p].test(request.url)) return p;
            }
        }
        return null;
    }

    function handleNewRequest(req) {
        var filter = checkFilters(req.request);
        if (filter === null || req.request.method === 'OPTIONS') return;

        req.filterTag = filter;

        if (!requests.length) requests.push({'page': req.pageref, 'entries': []});
        if (requests[requests.length - 1].page !== req.pageref) requests.push({'page': req.pageref, 'entries': []});
        requests[requests.length - 1].entries.push(req);

        m.redraw();
    }

    return {
        oninit: function() {
            chrome.devtools.network.onRequestFinished.addListener(handleNewRequest);
        },
        view: function() {
            return m('div#container', [m('div.toolbar', m(Toolbar, {clearRequests: function(){requests = [];}})),
                m('div.timeline', requests.map(function(x){return m(Timeline, {setActive: function(){active = x;}, request: x});})),
                m('div.inspector', m(Inspector, {beacon: active}))]);
        }
    };
};

module.exports = BeaconInspector;
