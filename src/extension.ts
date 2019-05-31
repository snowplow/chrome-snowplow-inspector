import m = require('mithril');
import SnowplowInspector = require('./components/SnowplowInspector');

// tslint:disable-next-line
require('./style/inspector.scss');

m.mount(document.body, SnowplowInspector);
