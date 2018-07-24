import m = require('mithril');
import BadRowsModal = require('./BadRowsModal');
import Beacon = require('./Beacon');
import Timeline = require('./Timeline');
import Toolbar = require('./Toolbar');

const spPattern = /^[^:]+:\/\/[^/?#;]+(\/[^/]+)*?\/(i\?(tv=|.*&tv=)|com\.snowplowanalytics\.snowplow\/tp2)/i;

const BeaconInspector = () => {
    let requests = [];
    let active;
    let filter;
    let modal: string | null = null;

    function isSnowplow(request) {
        return spPattern.test(request.url);
    }

    function handleNewRequest(req) {
        if (
            !isSnowplow(req.request) ||
            req.request.method === 'OPTIONS' ||
            req.response.statusText === 'Service Worker Fallback Required'
        ) {
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

    function setModal(modalName) {
        modal = modalName;
    }

    function isActive(beacon) {
        return !!(active && active.id === beacon.id);
    }

    return {
        oninit: () => chrome.devtools.network.onRequestFinished.addListener(handleNewRequest),
        view: () => ([
            m(Toolbar, {
                clearRequests: () => (requests = [], active = undefined),
                setModal,
            }),
            m('section.columns.section', [
                m('div.column.is-narrow.timeline',
                    m('div.panel',
                        m('input#filter[type=text][placeholder=Filter]', {
                            onkeyup: (e) => {
                                const t = e.currentTarget;
                                try {
                                    const f = !!t.value ? new RegExp(t.value, 'i') : undefined;
                                    filter = f;
                                    t.className = 'valid';
                                } catch (x) {
                                    t.className = 'invalid';
                                }
                            },
                        }),
                    ),
                    requests.map((x) => m(Timeline, { setActive, isActive, filter, request: x })),
                ),
                m('div.column.tile.is-ancestor.is-vertical.inspector',
                    m(Beacon, { activeBeacon: active })),
            ]),
            m(BadRowsModal, {
                addRequests: (pagename, reqs) => requests.push({ page: pagename, entries: reqs }),
                modal,
                setModal,
            }),
            m('div.jumper', {onclick: () => scrollTo(0, 0), title: 'Jump to Top'}),
        ]),
    };
};

export = BeaconInspector;
