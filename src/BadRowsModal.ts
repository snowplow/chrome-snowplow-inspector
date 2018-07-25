import m = require('mithril');
import ThriftCodec = require('./ThriftCodec');
import util = require('./util');

let badRows = '';

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

const thriftToRequest = (payload) => {
    const headers = [];
    const cookies = [{ name: 'sp', value: payload.networkUserId}];

    for (const p in payload.headers) {
        if (payload.headers.hasOwnProperty(p)) {
            headers.push({name: p, value: payload.headers[p]});
        }
    }

    return {
        pageref: 'page_bad',
        request: {
            cookies,
            headers,
            method: 'POST',
            postData: { text: util.tryb64(payload.body) },
            url: 'https://badbucket.example.org',
        },
        response: {},
        startedDateTime: JSON.stringify(new Date(payload.timestamp)),
    };
};

const badToRequests = (data: string[]) => {
    const logs = data.map((row) => {
        if (!row.length) {
            return;
        }

        let js = JSON.parse(row);

        if (typeof js === 'object' && js !== null && js.hasOwnProperty('line')) {
            js = js.line;
        }

        if (typeof js === 'string') {
            // Check for timestamp to identify Tomcat bad row logs
            if (/^[0-9 -]+\t/.test(js)) {
                const result: any = {headers: {}};
                js.split('\t').forEach((x, i) => {
                    switch (tomcat[i]) {
                    case 'timestamp':
                        if (result[tomcat[i]]) {
                            const d = new Date();
                            let parts = null;

                            // Pretty sure we see date first, but check if they're swapped just in case
                            if (x.indexOf(':') > -1) {
                                parts = x.split(':');
                                d.setHours(parts[0]);
                                d.setMinutes(parts[1]);
                                d.setSeconds(parts[2]);
                                parts = result[tomcat[i]].split('-');
                                d.setFullYear(parts[0]);
                                d.setMonth(parts[1]);
                                d.setDate(parts[2]);
                            } else {
                                parts = result[tomcat[i]].split(':');
                                d.setHours(parts[0]);
                                d.setMinutes(parts[1]);
                                d.setSeconds(parts[2]);
                                parts = x.split('-');
                                d.setFullYear(parts[0]);
                                d.setMonth(parts[1]);
                                d.setDate(parts[2]);
                            }

                            result[tomcat[i]] = +d;
                        } else {
                            result[tomcat[i]] = x;
                        }
                        break;
                    case 'body':
                        if (x !== '-') {
                            result[tomcat[i]] = util.tryb64(x);
                        }
                        break;
                    case 'querystring':
                        const qs = /cv=([^&]+).*nuid=([^&]+)/.exec(x);
                        if (qs) {
                            result.collector = qs[1];
                            result.networkUserId = qs[2];
                        }
                        break;
                    case 'userAgent':
                    case 'contentType':
                        result[tomcat[i]] = decodeURIComponent(x.replace(/\+/g, ' '));
                        break;
                    case 'refererUri':
                        result[tomcat[i]] = x;
                        result.headers.Referer = x;
                        break;
                    case null:
                        break;
                    default:
                        result[tomcat[i]] = x;
                    }
                });

                if (result.method === 'OPTIONS') {
                    return;
                } else {
                    return result;
                }
            // B64 encoded, hopefully thrift from mini/realtime
            } else if (/^([A-Za-z0-9/+]{4})+([A-Za-z0-9/+=]{4})?$/.test(js)) {
                return ThriftCodec.decodeB64Thrift(js, ThriftCodec.schemas['collector-payload']);
            }
        }
    });

    return logs.filter((x) => typeof x !== 'undefined').map(thriftToRequest);
};

export = {
    view: (vnode) => m('div.modal',
        { className: vnode.attrs.modal === 'badRows' ? 'is-active' : 'is-inactive' },
        [
            m('div.modal-background'),
            m('div.modal-card',
                [
                    m('header.modal-card-head', [
                        m('p.modal-card-title', 'Bad Rows Import'),
                        m('button.delete', { onclick: () => vnode.attrs.setModal(null) }),
                    ]),
                    m('section.modal-card-body', m('textarea.textarea',
                        {
                            oninput: m.withAttr('value', (value) => {
                                badRows = value;
                            }),
                            placeholder: 'Paste JSONL or base 64 events here, one per line',
                        })),
                    m('footer.modal-card-foot', m('button.button', { onclick: () => {
                        vnode.attrs.addRequests('Bad Rows', badToRequests(badRows.trim().split('\n')));
                        vnode.attrs.setModal(null);
                    } }, 'Import')),
                ]),
        ],
    ),
};
