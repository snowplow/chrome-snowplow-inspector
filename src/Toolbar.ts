import m = require('mithril');

const landingUrl = 'https://www.snowflake-analytics.com/?' + [
    'utm_source=debugger%20extension',
    'utm_medium=software',
    'utm_campaign=Chrome%20extension%20debugger%20window%20top-left',
].join('&');

export = {
    view: (vnode) => m('nav.navbar.is-flex-touch',
        [
            m('div.navbar-brand',
                m('a.navbar-item', { href: landingUrl, target: '_blank' },
                    m('img', { alt: 'Snowflake Analytics logo', src: 'sa-logo.png' }),
                ),
            ),
            m('div.navbar-menu.is-active.is-shadowless',
                m('div.navbar-start',
                    m('div.navbar-item.field.is-grouped',
                        m('a.button.is-outlined.is-small', { onclick: vnode.attrs.clearRequests }, 'Clear Events'),
                    ),
                ),
            ),
        ],
    ),
};
