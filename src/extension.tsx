import { h, render } from "preact";
import { SnowplowInspector } from "./components/SnowplowInspector";

document.documentElement.classList.add(
  "theme" + chrome.devtools.panels.themeName,
);
render(<SnowplowInspector />, document.body);
