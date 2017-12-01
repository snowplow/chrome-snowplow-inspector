var m = require('mithril');
var Beacon = require('./Beacon');

export = {
    view: function(vnode){
        if (vnode.attrs.beacon) return m('div.inspector-beacons', m(Beacon, vnode.attrs));
    }
};
