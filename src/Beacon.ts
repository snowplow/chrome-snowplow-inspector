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

function extractRequests(entry, index: number) {
    const req = entry.request;
    const id = entry.pageref + util.hash(entry.startedDateTime.toJSON() + req.url + index);
    const collector = new URL(req.url).hostname;
    const method = req.method;
    const beacons = [];

    const nuid = entry.request.cookies.filter((x) => x.name === 'sp')[0];
    const ua = entry.request.headers.filter((x) => x.name === 'User-Agent')[0];

    if (req.method === 'POST') {
        try {
            const payload = JSON.parse(req.postData.text);

            for (const pl of payload.data) {
                beacons.push(new Map(Object.keys(pl).map((x): [string, any] => ([x, pl[x]]))));
                if (nuid) {
                    beacons[beacons.length - 1].set('nuid', nuid.value);
                }
                if (ua) {
                    beacons[beacons.length - 1].set('ua', ua.value);
                }
            }

        } catch (e) {
            console.log('=================');
            console.log(e);
            console.log(JSON.stringify(req));
            console.log('=================');
        }

    } else {
        beacons.push(new URL(req.url).searchParams);
        if (nuid) {
            beacons[beacons.length - 1].set('nuid', nuid.value);
        }
        if (ua) {
            beacons[beacons.length - 1].set('ua', ua.value);
        }
    }

    return [[id, collector, method], beacons];
}

function parseBeacons(bl) {
    const [meta, blist] = bl;

    const results = [];

    for (const b of blist) {
        const result = {
            appId: printableValue(b.get('aid'), protocol.paramMap.aid),
            data: [],
            name: printableValue(b.get('e'), protocol.paramMap.e),
            time: printableValue(b.get('stm') || b.get('dtm'), protocol.paramMap.stm),
        };

        for (const gp of protocol.groupPriorities) {
            const name = gp.name;
            const fields = gp.fields;
            const rows = [];

            for (const field of fields) {
                const finfo = protocol.paramMap[field];

                let val = b.get(field);

                val = printableValue(val, finfo);

                if (val !== null) {
                    rows.push([finfo.name, val, genClasses(val, finfo)]);
                }

                b.delete(field);
            }

            if (rows.length) {
                result.data.push([name, rows]);
            }
        }

        const unknownRows = [];
        for (const field of b) {
            unknownRows.push([field[0], field[1], '']);
        }

        if (unknownRows.length) {
            result.data.push(['Unrecognised Fields', unknownRows]);
        }

        results.push(result);
    }

    return [meta, results];
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

        return m('table', rows);
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
            m('tbody', {class: visible ? 'show-rows' : 'hide-rows'},
               [
                   m('tr.header', {onclick: () => visible = !visible},
                   m('th', {colspan: 2}, vnode.attrs.setName)),
               ].concat(vnode.children)),
    };
};

const toTable = (rowset) => {
    const [setName, rows] = rowset;

    return m(RowSet, {setName}, rows.map((x) => m('tr', [m('th', x[0]), m('td', contextToTable(x[1]))])));
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
        return printableValue(atob(val.replace(/-/g, '+').replace(/_/g, '/')), {type: finfo.then});
    case 'enum':
        return val;
    case 'emap':
        return finfo.values[val] || val;
    default:
        return val;
    }
};

const formatBeacons = (dlist) => {
    const [[id, collector, method], d] = dlist;

    return d.map((x, i) =>
        m('table', {id: `${id}-${i}`},
            [
                m('col.field'),
                m('col.val'),
                m('thead',
                    m('tr', [m('th', `${x.time} | ${method} | ${collector}`), m('th', `${x.appId}: ${x.name}`)])),
            ].concat(x.data.map(toTable))),
    );
};

export = {
    extractRequests,
    view: (vnode) => m('div.request', vnode.attrs.beacon.entries
              .map(extractRequests)
              .map(parseBeacons)
              .map(formatBeacons)),
};
