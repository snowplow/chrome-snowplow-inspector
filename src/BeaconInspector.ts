import m = require('mithril');
import Beacon = require('./Beacon');
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
            requests.push({ page: req.pageref, entries: [] });
        }
        if (requests[requests.length - 1].page !== req.pageref) {
            requests.push({ page: req.pageref, entries: [] });
        }
        requests[requests.length - 1].entries.push(req);

        m.redraw();
    }

    function setActive(beacon) {
        active = beacon;
    }

    function isActive(beacon) {
        return !!(active && active.id === beacon.id);
    }

    return {
        oninit: () => chrome.devtools.network.onRequestFinished.addListener(handleNewRequest),
        view: () => ([
            m(Toolbar, { clearRequests: () => requests = [] }),
            m('section.columns.section', [
                m('div.column.is-narrow.timeline', requests.map((x) => (
                    m(Timeline, { setActive, isActive, request: x, tracker: sp })),
                )),
                m('div.column.tile.is-ancestor.is-vertical.inspector',
                    m(Beacon, { activeBeacon: active })),
            ]),
        ]),
    };
};

export = BeaconInspector;
