import { mount } from "mithril";
import { SnowplowInspector } from "./components/SnowplowInspector";

console.assert(false);
document.body.classList.add("theme" + chrome.devtools.panels.themeName);
mount(document.body, SnowplowInspector);
