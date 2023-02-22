import { h, render } from "preact";
import { GlacierThemeProvider } from "./glacier";
import { SnowplowInspector } from "./components/SnowplowInspector";

render(<GlacierThemeProvider><SnowplowInspector /></GlacierThemeProvider>, document.body);
