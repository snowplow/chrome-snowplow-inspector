import { h, render } from "preact";
import { SnowplowInspector } from "./components/SnowplowInspector";

document.body.classList.add("theme" + chrome.devtools.panels.themeName);
render(<SnowplowInspector />, document.body);
