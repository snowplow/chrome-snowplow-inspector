import m = require('mithril');
import protocol = require('./protocol');
import { BeaconDetail, IBeacon, IBeaconDetails, IBeaconSummary, IRowSet, ProtocolField } from './types';
import util = require('./util');
import validator = require('./validator');

function genClasses(finfo: ProtocolField): string {
    const classes = [];

    if (finfo.deprecated) {
        classes.push('deprecated');
    }

    return classes.join(' ');
}

function parseBeacon(beacon: IBeaconSummary): IBeaconDetails {
    const { collector, method, payload } = beacon;
    const result: IBeaconDetails = {
        appId: printableValue(payload.get('aid'), protocol.paramMap.aid as ProtocolField),
        collector,
        data: [],
        method,
        name: printableValue(payload.get('e'), protocol.paramMap.e as ProtocolField),
        time: printableValue(payload.get('stm') || payload.get('dtm'), protocol.paramMap.stm as ProtocolField),
    };

    const seen = new Set<string>();

    for (const gp of protocol.groupPriorities) {
        const name = gp.name;
        const fields = gp.fields;
        const rows = [];

        for (const field of fields) {
            const finfo = (protocol.paramMap as {[fieldkey: string]: ProtocolField})[field];

            let val = payload.get(field);

            val = printableValue(val, finfo);

            if (val !== null) {
                rows.push([finfo.name, val, genClasses(finfo)]);
                seen.add(field);
            }
        }

        if (rows.length) {
            result.data.push([name, rows, '']);
        }
    }

    const unknownRows = [];
    for (const [k, v] of payload) {
        if (!seen.has(k)) {
            unknownRows.push([k, v, '']);
        }
    }

    if (unknownRows.length) {
        result.data.push(['Unrecognised Fields', unknownRows, '']);
    }

    return result;
}

const labelType = (val: string) => m('button.typeinfo.button.is-pulled-right.is-info',
        {onclick: () => util.copyToClipboard(val), title: 'Click to copy'},
        util.nameType(val))
;

const contextToTable = (obj: any): m.Vnode | string => {
    if (typeof obj !== 'object' || obj === null) {
        return JSON.stringify(obj).replace(/^"|"$/g, '');
    }

    const rows = [];
    let p;

    if ('schema' in obj && 'data' in obj) {

        const validation = validator.validate(obj.schema, obj.data);
        const validity = validation.valid ? 'Valid' : validation.location === null ? 'Unrecognised' : 'Invalid';
        const errorText = validation.errors.join('\n') || validation.location;

        if ('schema' in obj.data) {
            rows.push(contextToTable(obj.data));
        } else {
            for (p in obj.data) {
                if (obj.data.hasOwnProperty(p)) {
                    const type = util.nameType(obj.data[p]);
                    if ((type === 'object' || type === 'array') && util.hasMembers(obj.data[p])) {
                        rows.push(m('tr', [
                            m('th', p),
                            m('td', contextToTable(obj.data[p])),
                        ]));
                    } else {
                        rows.push(m('tr', [
                            m('th', p),
                            m('td', [
                                labelType(obj.data[p]),
                                contextToTable(obj.data[p]),
                            ]),
                        ]));
                    }
                }
            }
        }

        return m('div.card.iglu', {class: validity.toLowerCase()},
            m('header.card-header',
                m('a.card-header-title',
                    {target: '_blank', href: validation.location || 'javascript:void(0);'},
                    obj.schema),
            m('span.card-header-icon', ''),
            ),
            m('div.card-content', m('table.table.is-fullwidth', rows)),
            m('footer.card-footer',
                m('abbr.card-footer-item.validation', {onclick: () => {
                    if (validity === 'Unrecognised') {
                        chrome.runtime.openOptionsPage();
                    } else {
                        util.copyToClipboard(errorText);
                    }
                }, title: errorText}, validity),
                m('textarea.card-footer-item[readonly]', {value: JSON.stringify(obj)}),
            ),
        );
    } else {
        for (p in obj) {
            if (obj.hasOwnProperty(p)) {
                const type = util.nameType(obj[p]);
                if ((type === 'object' || type === 'array') && util.hasMembers(obj[p])) {
                    rows.push(m('tr', [
                        m('th', p),
                        m('td', contextToTable(obj[p])),
                    ]));
                } else {
                    rows.push(m('tr', [
                        m('th', p),
                        m('td', [
                            labelType(obj[p]),
                            contextToTable(obj[p]),
                        ]),
                    ]));
                }
            }
        }

        return m('table.table.is-fullwidth', rows);
    }
};

const RowSet = () => {
    let visible = true;
    return {
        view: (vnode: m.Vnode<IRowSet>) =>
            m('div.card.tile.is-child', { class: visible ? 'show-rows' : 'hide-rows' },
                m('header.card-header', { onclick: () => visible = !visible },
                    m('p.card-header-title', vnode.attrs.setName),
                    m('a.card-header-icon', visible ? '[ - ]' : '[ + ]')),
                m('div.card-content', m('table.table.is-fullwidth', vnode.children))),
    };
};

const toTable = (rowset: BeaconDetail) => {
    const [setName, rows] = rowset;

    return m(RowSet, { setName },
                rows.map((x: [string, any]) => {
                    if (!/Custom Context|(Unstructured|Self-Describing) Event/.test(x[0])) {
                        return m('tr', [m('th', x[0]), m('td', [
                            labelType(x[1]),
                            contextToTable(x[1]),
                        ])]);
                    } else {
                        return contextToTable(x[1]);
                    }
                }));
};

const printableValue = (val: string | undefined, finfo: ProtocolField): any => {
    if (val === undefined || val === null || val === '') {
        return null;
    }

    switch (finfo.type) {
    case 'text':
        return val;
    case 'epoc':
        return new Date(parseInt(val, 10)).toISOString();
    case 'numb':
        return parseInt(val, 10);
    case 'doub':
        return parseFloat(val);
    case 'bool':
        return val === '1';
    case 'uuid':
        return val.toLowerCase();
    case 'json':
        return JSON.parse(val);
    case 'ba64':
        return printableValue(atob(val.replace(/-/g, '+').replace(/_/g, '/')), { name: finfo.name, type: finfo.then });
    case 'enum':
        return val;
    case 'emap':
        return finfo.values[val] || val;
    default:
        return val;
    }
};

const formatBeacon = (d: IBeaconDetails) => [
    m('div.level.box', [
        m('div.level-item.has-text-centered', m('div', [m('p.heading', 'App'), m('p.title', d.appId)])),
        m('div.level-item.has-text-centered', m('div', [m('p.heading', 'Event'), m('p.title', d.name)])),
    ]),
    m('div.level.box', [
        m('div.level-item.has-text-centered', m('div', [
            m('p.heading', 'Time'),
            m('time.title', {datetime: d.time}, new Date(d.time).toUTCString()),
        ])),
    ]),
    m('div.level.box', [
        m('div.level-item.has-text-centered', m('div', [m('p.heading', 'collector'), m('p.title', d.collector)])),
        m('div.level-item.has-text-centered', m('div', [m('p.heading', 'Method'), m('p.title', d.method)])),
    ]),
].concat(d.data.map(toTable));

export = {
    view: (vnode: m.Vnode<IBeacon>) => vnode.attrs.activeBeacon && formatBeacon(parseBeacon(vnode.attrs.activeBeacon)),
};
