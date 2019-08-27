import m = require('mithril');
import SnowplowInspector = require('./components/SnowplowInspector');

// tslint:disable-next-line
require('./style/inspector.scss');

// tslint:disable-next-line
declare module chrome.devtools.panels {
    export const themeName: string;
}

document.body.classList.add('theme' + chrome.devtools.panels.themeName);

m.mount(document.body, SnowplowInspector);
