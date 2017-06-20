var m = require('mithril');

var landingUrl = 'https://www.snowflake-analytics.com/?utm_source=debugger%20extension&utm_medium=software&utm_campaign=Chrome%20extension%20debugger%20window%20top-left';

module.exports = {
    view: function(vnode) {
        return [m('a.logo', {href: landingUrl, target: '_blank'}, m('img', {alt: 'Snowflake Analytics logo', src: 'sa-logo.png'})), m('button.clear', {onclick: vnode.attrs.clearRequests}, 'Clear')];
    }
};