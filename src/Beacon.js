var m = require('mithril');
var protocol = require('./protocol.js');
var util = require('./util');

function genClasses(val, finfo) {
    var classes = [];

    if (finfo.deprecated) classes.push('deprecated');

    return classes.join(' ');
}

function extractRequests(entry, index) {
    var req = entry.request;
    var id = entry.pageref + util.hash(entry.startedDateTime.toJSON() + req.url + index);
    var collector = new URL(req.url).hostname;
    var method = req.method;
    var beacons = [];

    var nuid = entry.request.cookies.filter(function(x){return x.name === 'sp'})[0];
    var ua = entry.request.headers.filter(function(x){return x.name === 'User-Agent'})[0];

    if (req.method === 'POST') {
        try {
            var payload = JSON.parse(req.postData.text);

            for (var i = 0; i < payload.data.length; i++) {
                beacons.push(new Map(Object.keys(payload.data[i]).map(function(x){return [x, payload.data[i][x]];})));
                if (nuid) beacons[beacons.length -1].set('nuid', nuid.value);
                if (ua) beacons[beacons.length -1].set('ua', ua.value);
            }

        } catch (e) {
            console.log('=================');
            console.log(e);
            console.log(JSON.stringify(req));
            console.log('=================');
        }

    } else {
        beacons.push(new URL(req.url).searchParams);
        if (nuid) beacons[beacons.length -1].set('nuid', nuid.value);
        if (ua) beacons[beacons.length -1].set('ua', ua.value);
    }

    return [[id, collector, method], beacons];
}

function parseBeacons(bl) {
    var meta = bl[0];
    bl = bl[1];

    var results = [];

    for (var i = 0; i < bl.length; i++) {
        var result = {};
        result.name = printableValue(bl[i].get('e'), protocol.paramMap['e']);
        result.appId = printableValue(bl[i].get('aid'), protocol.paramMap['aid']);
        result.time = printableValue(bl[i].get('stm') || bl[i].get('dtm'), protocol.paramMap['stm']);
        result['data'] = [];

        for (var j = 0; j < protocol.groupPriorities.length; j++) {
            var name = protocol.groupPriorities[j].name;
            var fields = protocol.groupPriorities[j].fields;
            var rows = [];

            for (var k = 0; k < fields.length; k++) {
                var finfo = protocol.paramMap[fields[k]];

                var val = bl[i].get(fields[k]);// || req.headers[finfo.header];

                val = printableValue(val, finfo);

                if (val !== null) {
                    rows.push([finfo.name, val, genClasses(val, finfo)]);
                }

                bl[i].delete(fields[k]);
            }


            if (rows.length) {
                result['data'].push([name, rows]);
            }

        }

        var unknownRows = [];
        for (j = 0; j < bl[i].length; j++) {
            unknownRows.push([bl[i][j][0], bl[i][j][1], '']);
        }

        if (unknownRows.length) result['data'].push(['Unrecognised Fields', unknownRows]);

        results.push(result);
    }

    return [meta, results];
}

function contextToTable(obj) {
    if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj).replace(/^"|"$/g, '');

    var rows = [];
    var p;

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
}

var RowSet = function() {
    var visible = true;
    return {
        view: function(vnode) {
            return m('tbody', {class: visible ? 'show-rows' : 'hide-rows'}, [m('tr.header', {onclick: function(){visible = !visible}}, m('th', {colspan: 2}, vnode.attrs.setName))].concat(vnode.children));
        }
    }
};

function toTable(rowset) {
    var setName = rowset[0];
    var rows = rowset[1];

    return m(RowSet, {setName: setName}, rows.map(function(x){
        return m('tr', [m('th', x[0]), m('td', contextToTable(x[1]))]);
    }));
}

function printableValue(val, finfo) {
    if (val === undefined || val === null || val === '') return null;

    switch (finfo.type) {
    case 'text':
        return val;
    case 'epoc':
        return new Date(parseInt(val, 10)).toISOString();
    case 'numb':
        return parseInt(val, 10);
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
}

function formatBeacons(d) {
    var meta = d[0];
    d = d[1];

    return d.map(function(x, i){
        return m('table', {id: meta[0] + '-' + i},
            [
                m('col.field'),
                m('col.val'),
                m('thead',
                    m('tr', [m('th',x.time + ' | ' + meta[2] + ' | ' + meta[1]), m('th', x.appId + ': ' + x.name)]))
            ].concat(x.data.map(toTable)));
    });
}

module.exports = {
    view: function(vnode) {
        return m('div.request', vnode.attrs.entries.map(extractRequests).map(parseBeacons).map(formatBeacons));
    },
    extractRequests: extractRequests
};