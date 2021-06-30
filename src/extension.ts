import m = require("mithril");
import SnowplowInspector = require("./components/SnowplowInspector");

document.body.classList.add("theme" + chrome.devtools.panels.themeName);

m.mount(document.body, SnowplowInspector);
