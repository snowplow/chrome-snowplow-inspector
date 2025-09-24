import { h, render } from "preact";
import { SnowplowInspector } from "./components/SnowplowInspector";
import "./styles/fonts.scss";
import "./styles/tailwind.css";

document.documentElement.classList.add(
  "theme" + (chrome?.devtools?.panels?.themeName || "default"),
);
render(<SnowplowInspector />, document.body);
