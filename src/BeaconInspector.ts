import * as har from 'har-format';
import m = require('mithril');
import BadRowsModal = require('./BadRowsModal');
import Beacon = require('./Beacon');
import Timeline = require('./Timeline');
import Toolbar = require('./Toolbar');
import { IBeaconSummary, IPageRequests } from './types';

const spPattern = /^[^:]+:\/\/[^/?#;]+(\/[^/]+)*?\/(i\?(tv=|.*&tv=)|com\.snowplowanalytics\.snowplow\/tp2)/i;

const BeaconInspector = () => {
    let requests: IPageRequests[] = [];
    let active: IBeaconSummary | undefined;
    let filter: RegExp | undefined;
    let modal: string | undefined;

    function isSnowplow(request: har.Request) {
        return spPattern.test(request.url);
    }

    function handleNewRequest(req: har.Entry): void {
        if (
            !isSnowplow(req.request) ||
            req.request.method === 'OPTIONS' ||
            req.response.statusText === 'Service Worker Fallback Required'
        ) {
            return;
        }

        if (!requests.length) {
            requests.push({ page: req.pageref, entries: [] } as IPageRequests);
        }
        if (requests[requests.length - 1].page !== req.pageref) {
            requests.push({ page: req.pageref, entries: [] } as IPageRequests);
        }
        requests[requests.length - 1].entries.push(req);

        m.redraw();
    }

    function setActive(beacon: IBeaconSummary) {
        active = beacon;
    }

    function setModal(modalName?: string) {
        modal = modalName;
    }

    function isActive(beacon: IBeaconSummary) {
        return !!(active && active.id === beacon.id);
    }

    return {
        // @ts-ignore typedefs for chrome aren't complete for the HAR spec.
        oninit: () => chrome.devtools.network.onRequestFinished.addListener(handleNewRequest),
        view: () => ([
            m(Toolbar, {
                clearRequests: () => (requests = [], active = undefined),
                setModal,
            }),
            m('section.columns.section', [
                m('div.column.is-narrow.timeline',
                    m('div.panel.filterPanel',
                        m('input#filter[type=text][placeholder=Filter]', {
                            onkeyup: (e: KeyboardEvent) => {
                                const t = e.currentTarget as HTMLInputElement;
                                try {
                                    const f = (t && !!t.value) ? new RegExp(t.value, 'i') : undefined;
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
                m('div#beacon.column',
                    m('div.tile.is-ancestor.is-vertical.inspector',
                        m(Beacon, { activeBeacon: active }))),
            ]),
            m(BadRowsModal, {
                addRequests: (pagename: string, reqs: har.Entry[]) => requests.push({ page: pagename, entries: reqs }),
                modal,
                setModal,
            }),
        ]),
    };
};

export = BeaconInspector;
