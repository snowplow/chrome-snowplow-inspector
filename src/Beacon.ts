import m = require('mithril');
import protocol = require('./protocol');
import util = require('./util');

function genClasses(val, finfo) {
    const classes = [];

    if (finfo.deprecated) {
        classes.push('deprecated');
    }

    return classes.join(' ');
}

function parseBeacon(beacon) {
    const { collector, method, payload } = beacon;
    const result = {
        appId: printableValue(payload.get('aid'), protocol.paramMap.aid),
        collector,
        data: [],
        method,
        name: printableValue(payload.get('e'), protocol.paramMap.e),
        time: printableValue(payload.get('stm') || payload.get('dtm'), protocol.paramMap.stm),
    };

    for (const gp of protocol.groupPriorities) {
        const name = gp.name;
        const fields = gp.fields;
        const rows = [];

        for (const field of fields) {
            const finfo = protocol.paramMap[field];

            let val = payload.get(field);

            val = printableValue(val, finfo);

            if (val !== null) {
                rows.push([finfo.name, val, genClasses(val, finfo)]);
            }
        }

        if (rows.length) {
            result.data.push([name, rows]);
        }
    }

    const unknownRows = [];
    for (const field of payload) {
        unknownRows.push([field[0], field[1], '']);
    }

    if (unknownRows.length) {
        result.data.push(['Unrecognised Fields', unknownRows]);
    }

    return result;
}

const contextToTable = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
        return JSON.stringify(obj).replace(/^"|"$/g, '');
    }

    const rows = [];
    let p;

    if ('schema' in obj && 'data' in obj) {

        rows.push(m('tr', [m('th', 'Schema'), m('td', obj.schema)]));

        if ('schema' in obj.data) {
            rows.push(m('tr', [m('th', 'Data'), contextToTable(obj.data)]));
        } else {
            for (p in obj.data) {
                if (obj.data.hasOwnProperty(p)) {
                    rows.push(m('tr', [m('th', p), m('td', contextToTable(obj.data[p]))]));
                }
            }
        }

        return m('table.is-fullwidth', rows);
    } else {
        for (p in obj) {
            if (obj.hasOwnProperty(p)) {
                rows.push(m('tr', [m('th', p), m('td', contextToTable(obj[p]))]));
            }
        }

        return m('table', rows);
    }
};

const RowSet = () => {
    let visible = true;
    return {
        view: (vnode) =>
            m('div.card.tile.is-child', { class: visible ? 'show-rows' : 'hide-rows' },
                m('header.card-header', { onclick: () => visible = !visible },
                    m('p.card-header-title', vnode.attrs.setName),
                    m('a.card-header-icon', visible ? '-' : '+')),
                m('div.card-content', m('table.table.is-fullwidth', vnode.children))),
    };
};

const toTable = (rowset) => {
    const [setName, rows] = rowset;

    return m(RowSet, { setName }, rows.map((x) => m('tr', [m('th', x[0]), m('td', contextToTable(x[1]))])));
};

const printableValue = (val, finfo) => {
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
        return printableValue(atob(val.replace(/-/g, '+').replace(/_/g, '/')), { type: finfo.then });
    case 'enum':
        return val;
    case 'emap':
        return finfo.values[val] || val;
    default:
        return val;
    }
};

const formatBeacon = (d) => [
    m('div.level.box', [
        m('div.level-item.has-text-centered', m('div', [m('p.heading', 'Time'), m('p.title', d.time)])),
        m('div.level-item.has-text-centered', m('div', [m('p.heading', 'Method'), m('p.title', d.method)])),
        m('div.level-item.has-text-centered', m('div', [m('p.heading', 'Event'), m('p.title', d.name)])),
    ]),
    m('div.level.box', [
        m('div.level-item.has-text-centered', m('div', [m('p.heading', 'App'), m('p.title', d.appId)])),
        m('div.level-item.has-text-centered', m('div', [m('p.heading', 'collector'), m('p.title', d.collector)])),
    ]),
].concat(d.data.map(toTable));

export = {
    view: (vnode) => vnode.attrs.activeBeacon && formatBeacon(parseBeacon(vnode.attrs.activeBeacon)),
};