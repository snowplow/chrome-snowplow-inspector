import * as har from 'har-format';
import m = require('mithril');
import { Application, IBeaconSummary, IPageRequests } from '../ts/types';
import BadRowsModal = require('./BadRowsModal');
import Beacon = require('./Beacon');
import LiveStreamModal = require('./LiveStreamModal');
import SchemaManager = require('./SchemaManager');
import Timeline = require('./Timeline');
import Toolbar = require('./Toolbar');

const spPattern = /^[^:]+:\/\/[^/?#;]+(\/[^/]+)*?\/(i\?(tv=|.*&tv=)|com\.snowplowanalytics\.snowplow\/tp2)/i;
const plPattern = /^iglu:[^\/]+\/payload_data/i;

const SnowplowInspector = () => {
    let requests: IPageRequests[] = [];
    let active: IBeaconSummary | undefined;
    let filter: RegExp | undefined;
    let modal: string | undefined;
    let application: Application = 'debugger';

    function isSnowplow(request: har.Request): boolean {
        if (spPattern.test(request.url)) {
            return true;
        } else {
            // It's possible that the request uses a custom endpoint via postPath
            if (request.method === 'POST' && typeof request.postData !== 'undefined') {
                // Custom endpoints only support POST requests
                try {
                    const post = JSON.parse(request.postData.text!) || {};
                    return typeof post === 'object' && 'schema' in post && plPattern.test(post.schema);
                } catch {
                    // invalid JSON, not a Snowplow event
                }
            }
        }

        return false;
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

    function addRequests(pagename: string, reqs: har.Entry[]) {
        reqs.forEach((v) => {
            v.pageref = pagename || v.pageref;
            handleNewRequest(v);
        });
    }

    function changeApp(app: Application) {
        application = app;
    }

    return {
        oninit: () => {
            chrome.devtools.network.getHAR((harLog) => {
                (harLog as { entries: har.Entry[] }).entries.map(handleNewRequest);

                // @ts-ignore typedefs for chrome aren't complete for the HAR spec.
                chrome.devtools.network.onRequestFinished.addListener(handleNewRequest);
            });
        },
        view: () => {
            let app;
            switch(application) {
                case 'debugger':
                    app = m('section.columns.section', [
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
                ]);
                break;
                case 'schemaManager':
                    app = m(SchemaManager);
                    break;

            }

            console.log(app);
            return [
                m(Toolbar, {
                    addRequests,
                    changeApp,
                    clearRequests: () => (requests = [], active = undefined),
                    setModal,
                }),
                app,
                m(BadRowsModal, {
                    addRequests,
                    modal,
                    setModal,
                }),
                m(LiveStreamModal, {
                    addRequests,
                    modal,
                    setModal,
                }),
            ];
        },
    };
};

export = SnowplowInspector;
