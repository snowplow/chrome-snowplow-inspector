import m = require('mithril');
import Inspector = require('./Inspector');
import Timeline = require('./Timeline');
import Toolbar = require('./Toolbar');

declare const Snowplow: any;

const BeaconInspector = () => {
    let requests = [];
    let active;
    let sp;

    const filters = {
        snowplow: /^[^:]+:\/\/[^/?#;]+\/(i\?(tv=|.*&tv=)|com\.snowplowanalytics\.snowplow\/tp2)/i,
    };

    /* global Snowplow:false */
    sp = Snowplow.getTrackerUrl('d.snowflake-analytics.com');
    sp.setAppId('snowplow-chrome-extension');
    sp.setPlatform('app');

    function checkFilters(request) {
        for (const p in filters) {
            if (filters.hasOwnProperty(p)) {
                if (filters[p].test(request.url)) {
                    return p;
                }
            }
        }
        return null;
    }

    function handleNewRequest(req) {
        const filter = checkFilters(req.request);
        if (filter === null || req.request.method === 'OPTIONS') {
            return;
        }

        req.filterTag = filter;

        if (!requests.length) {
            requests.push({page: req.pageref, entries: []});
        }
        if (requests[requests.length - 1].page !== req.pageref) {
            requests.push({page: req.pageref, entries: []});
        }
        requests[requests.length - 1].entries.push(req);

        m.redraw();
    }

    return {
        oninit: () => chrome.devtools.network.onRequestFinished.addListener(handleNewRequest),
        view: () => m('div#container',
            [
                m('div.toolbar', m(Toolbar, {clearRequests: () => requests = []})),
                m('div.timeline', requests.map((x) => (m(Timeline,
                    {setActive: () => active = x, request: x, tracker: sp})))),
                m('div.inspector', m(Inspector, {beacon: active})),
            ]),
    };
};

export = BeaconInspector;
