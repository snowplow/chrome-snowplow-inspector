import m = require('mithril');
import Inspector = require('./Inspector');
import Timeline = require('./Timeline');
import Toolbar = require('./Toolbar');

declare const Snowplow: any;

const spPattern = /^[^:]+:\/\/[^/?#;]+\/(i\?(tv=|.*&tv=)|com\.snowplowanalytics\.snowplow\/tp2)/i;

const BeaconInspector = () => {
    let requests = [];
    let active;

    /* global Snowplow:false */
    const sp = Snowplow.getTrackerUrl('d.snowflake-analytics.com');
    sp.setAppId('snowplow-chrome-extension');
    sp.setPlatform('app');

    function isSnowplow(request) {
        return spPattern.test(request.url);
    }

    function handleNewRequest(req) {
        if (!isSnowplow(req.request) || req.request.method === 'OPTIONS') {
            return;
        }

        if (!requests.length) {
            requests.push({page: req.pageref, entries: []});
        }
        if (requests[requests.length - 1].page !== req.pageref) {
            requests.push({page: req.pageref, entries: []});
        }
        requests[requests.length - 1].entries.push(req);

        m.redraw();
    }

    function setActive(beacon) {
        active = beacon;
    }

    return {
        oninit: () => chrome.devtools.network.onRequestFinished.addListener(handleNewRequest),
        view: () => m('div#container',
            [
                m('div.toolbar', m(Toolbar, {clearRequests: () => requests = []})),
                m('div.timeline', requests.map((x) => (m(Timeline,
                    {setActive, request: x, tracker: sp})))),
                m('div.inspector', m(Inspector, {activeBeacon: active})),
            ]),
    };
};

export = BeaconInspector;
