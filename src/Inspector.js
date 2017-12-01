var m = require('mithril');
var Beacon = require('./Beacon');

/* global sp, Snowplow:false */
window.sp = Snowplow.getTrackerUrl('d.snowflake-analytics.com');
sp.setAppId('snowplow-chrome-extension');
sp.setPlatform('app');

module.exports = {
    view: function(vnode){
        if (vnode.attrs.beacon) return m('div.inspector-beacons', m(Beacon, vnode.attrs));
    }
};
