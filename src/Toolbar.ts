import m = require('mithril');
import analytics = require('./analytics');
import { IToolbar } from './types';
import validator = require('./validator');

export = {
    view: (vnode: m.Vnode<IToolbar>) => m('nav.navbar.is-flex-touch',
        [
            m('div.navbar-brand',
                m('a.navbar-item', { href: analytics.landingUrl, target: '_blank' },
                    m('img', { alt: 'Poplin Data logo', src: 'pd-logo.png' }),
                ),
            ),
            m('div.navbar-menu.is-active.is-shadowless',
                m('div.navbar-start',
                    m('div.navbar-item.field.is-grouped', [
                        m('a.button.is-outlined.is-small.control', { onclick: vnode.attrs.clearRequests },
                            'Clear Events'),
                        m('a.button.is-outlined.is-small.control', { onclick: validator.clearCache },
                            'Clear Schema Cache'),
                        m('a.button.is-outlined.is-small.control', { onclick: () => vnode.attrs.setModal('badRows') },
                            'Import Bad Rows'),
                    ]),
                ),
            ),
        ],
    ),
};
