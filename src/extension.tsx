import { h, render } from "preact";
import { SnowplowInspector } from "./components/SnowplowInspector";

const themes = ["default", "light", "dark", "auto", "firebug"] as const;

function setTheme(theme: (typeof themes)[number]) {
  document.documentElement.classList.remove(...themes.map((t) => `theme${t}`));
  document.documentElement.classList.add(`theme${theme}`);
}

setTheme(chrome.devtools.panels.themeName);

// this isn't documented but is good enough for React apparently
// https://github.com/facebook/react/pull/33992
if ("setThemeChangeHandler" in chrome.devtools.panels) {
  (chrome.devtools.panels as any).setThemeChangeHandler(setTheme);
} else if ("onThemeChanged" in chrome.devtools.panels) {
  (chrome.devtools.panels as any).onThemeChanged.addListener(setTheme);
}

render(<SnowplowInspector />, document.body);
