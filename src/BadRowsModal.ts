import * as har from 'har-format';
import m = require('mithril');
import ThriftCodec = require('./ThriftCodec');
import { IBadRowsSummary, ITomcatImport } from './types';
import util = require('./util');

let badRows: string[] = [];

// Formats: https://github.com/snowplow/snowplow/wiki/Collector-logging-formats
const tomcat = [
    'timestamp', // date
    'timestamp', // time
    null, // x-edge-location
    null, // bytes sent
    'ipAddress',
    'method', // method
    'hostname', // remote host
    'path',
    null, // status code
    'refererUri',
    'userAgent',
    'querystring',
    null, // cookies
    null, // x-edge-result-type
    null, // x-edge-request-id
    'contentType',
    'body',
    null, // protocol
    null, // cs-bytes
    null, // time-taken
];

const thriftToRequest = (payload?: ITomcatImport): Partial<har.Entry> | undefined => {
    if (typeof payload !== 'object' ||
        payload === null ||
        (!payload.hasOwnProperty('querystring') && !payload.hasOwnProperty('body'))) {
        return;
    }

    const headers: har.Header[] = [];
    const cookies: har.Cookie[] = [{ name: 'sp', value: (payload.networkUserId as string)}];

    const pheaders = (payload.headers as {[header: string]: string});
    for (const p in pheaders) {
        if (payload.headers.hasOwnProperty(p) && pheaders[p] !== '-') {
            headers.push({name: p, value: pheaders[p]});
        }
    }

    const uri = [
        'https://',
        'badbucket.example.org',
        (payload.path || '/'),
        (payload.querystring ? '?' + payload.querystring : ''),
    ].join('');

    // mock out the rest of the Entry interface
    return {
        pageref: 'page_bad',
        request: {
            bodySize: 0,
            cookies,
            headers,
            headersSize: 0,
            httpVersion: 'HTTP/1.1',
            method: 'body' in payload ? 'POST' : 'GET',
            postData: {
                mimeType: 'application/json',
                params: [],
                text: util.tryb64(payload.body as string),
            },
            queryString: [],
            url: uri,
        },
        response: {
            bodySize: 0,
            content: {
                mimeType: 'text/html',
                size: 0,
                text: '',
            },
            cookies,
            headers: [],
            headersSize: 0,
            httpVersion: 'HTTP/1.1',
            redirectURL: '',
            status: 200,
            statusText: 'OK',
        },
        startedDateTime: JSON.stringify(new Date(payload.timestamp as string)),
    };
};

const badToRequests = (data: string[]): har.Entry[] => {
    const logs = data.map((row) => {
        if (!row.length) {
            return;
        }

        let js = null;

        try {
            js = JSON.parse(row);
        } catch {
            js = row;
        }

        if (typeof js === 'object' && js !== null && js.hasOwnProperty('line')) {
            js = js.line;
        }

        if (typeof js === 'string') {
            // Check for timestamp to identify Tomcat bad row logs
            if (/^[0-9 -]+\t/.test(js)) {
                const result: ITomcatImport  = { headers: { Referer: ''} };
                js.split('\t').forEach((x, i) => {
                    const field = tomcat[i];
                    switch (field) {
                    case 'timestamp':
                        // There are two timestamp fields, check if we've already processed one
                        if (result.hasOwnProperty(field) && typeof result[field] === 'string') {
                            const d = new Date();
                            let parts = null;

                            // Pretty sure we see date first, but check if they're swapped just in case
                            if (x.indexOf(':') > -1) {
                                parts = x.split(':').map((p: string) => parseInt(p, 10));
                                d.setHours(parts[0]);
                                d.setMinutes(parts[1]);
                                d.setSeconds(parts[2]);
                                // @ts-ignore we know this is a string from above
                                parts = result[field].split('-');
                                d.setFullYear(parts[0]);
                                d.setMonth(parts[1]);
                                d.setDate(parts[2]);
                            } else {
                                // @ts-ignore we know this is a string from above
                                parts = result[field].split(':');
                                d.setHours(parts[0]);
                                d.setMinutes(parts[1]);
                                d.setSeconds(parts[2]);
                                parts = x.split('-').map((p: string) => parseInt(p, 10));
                                d.setFullYear(parts[0]);
                                d.setMonth(parts[1]);
                                d.setDate(parts[2]);
                            }

                            result[field] = '' + (+d);
                        } else {
                            result[field] = x;
                        }
                        break;
                    case 'body':
                        if (x !== '-') {
                            result.body = util.tryb64(x);
                        }
                        break;
                    case 'querystring':
                        const qs = /cv=([^&]+).*nuid=([^&]+)/.exec(x);
                        if (qs) {
                            result.collector = qs[1];
                            result.networkUserId = qs[2];
                        }
                        result[field] = x;
                        break;
                    case 'userAgent':
                    case 'contentType':
                        result[field] = decodeURIComponent(x.replace(/\+/g, ' '));
                        break;
                    case 'refererUri':
                        result[field] = x;
                        if (typeof result.headers === 'object') {
                            result.headers.Referer = x;
                        }
                        break;
                    case null:
                        break;
                    default:
                        result[field] = x;
                    }
                });

                if (result.method === 'OPTIONS') {
                    return;
                } else {
                    return result;
                }
            // B64 encoded, hopefully thrift from mini/realtime
            } else if (/^([A-Za-z0-9/+]{4})+([A-Za-z0-9/+=]{4})?$/.test(js)) {
                try {
                    return ThriftCodec.decodeB64Thrift(js, ThriftCodec.schemas['collector-payload']) as ITomcatImport;
                } catch (e) {
                    console.log(e);
                }
            }
        }
    });

    const entries = [];

    for (const entry of logs.map(thriftToRequest)) {
        if (entry !== undefined) {
            entries.push(entry as har.Entry);
        }
    }

    return entries;
};

export = {
    view: (vnode: m.Vnode<IBadRowsSummary>) => m('div.modal',
        { className: vnode.attrs.modal === 'badRows' ? 'is-active' : 'is-inactive' },
        [
            m('div.modal-background'),
            m('div.modal-card',
                [
                    m('header.modal-card-head', [
                        m('p.modal-card-title', 'Bad Rows Import'),
                        m('button.delete', { onclick: () => vnode.attrs.setModal(undefined) }),
                    ]),
                    m('section.modal-card-body', [
                        m('p',
                            `Bad Rows occur when events fail to validate during enrichment.
                            You can paste your bad data straight from S3 (1 JSON object per line),
                            or, for real-time data, the JSON object from the _source field in ElasticSearch
                            or just the line property of that object. Keep pasting to include events in bulk.
                            Invalid payloads (OPTIONS requests, no data, invalid JSON, bots, etc.) will be ignored.`,
                        ),
                        m('textarea.textarea',
                            {
                                onpaste: (e: ClipboardEvent) => {
                                    e.preventDefault();
                                    badRows = badRows.concat(e.clipboardData.getData('text').trim().split('\n'));
                                },
                                placeholder: 'Paste JSONL or base 64 events here, one per line',
                                rows: 1,
                            },
                        ),
                        m('p', ['Number of events to try to import: ', badRows.length]),
                    ]),
                    m('footer.modal-card-foot', m('button.button', { onclick: () => {
                        if (badRows.length) {
                            vnode.attrs.addRequests('Bad Rows', badToRequests(badRows));
                            badRows = [];
                            vnode.attrs.setModal(undefined);
                        }
                    } }, 'Import')),
                ]),
        ],
    ),
};
