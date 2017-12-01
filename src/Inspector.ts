var m = require('mithril');
var Beacon = require('./Beacon');

export = {
    view: (vnode) =>
        (vnode.attrs.beacon && m('div.inspector-beacons', m(Beacon, vnode.attrs)))
};
