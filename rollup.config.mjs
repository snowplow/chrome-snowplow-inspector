import { readFileSync } from "fs";
import { basename, resolve as resolvePath } from "path";

import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import html from "@rollup/plugin-html";
import resolve from "@rollup/plugin-node-resolve";
import styles from "@ironkinoko/rollup-plugin-styles";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const in_development = !!process.env.ROLLUP_WATCH;

export default Object.entries({
  "src/extension.tsx": "panel.html",
  "src/devtools.ts": "devtools.html",
  "src/options.tsx": "options.html",
  "src/popup.tsx": "popup.html",
}).map(([input, fileName], i) => ({
  strictDeprecations: true,
  input,
  output: {
    dir: "dist",
    format: "iife",
    entryFileNames: "[name].js",
    sourcemap: in_development,
    compact: !in_development,
    plugins: in_development ? [] : [terser()],
  },
  plugins: [
    i === 0
      ? copy({
          input: [
            "manifest.json",
            "res/logo.svg",
            "res/icon.png",
            "res/icon-16.png",
            "res/icon-48.png",
            "res/icon-128.png",
            "LICENSE.md",
          ],
        })
      : {},
    resolve({ browser: true }),
    commonjs(),
    alias({
      entries: {
        url: resolvePath("./src/uri.js"),
        buffer: "",
      },
    }),
    typescript(),
    styles({
      mode: "extract",
      minimize: !in_development,
      sourceMap: in_development,
    }),
    html({
      fileName,
      title: "Snowplow Inspector",
    }),
  ],
}));

function copy(opts) {
  return {
    name: "copy",
    buildStart() {
      opts.input.forEach((target) => {
        this.addWatchFile(target);
        this.emitFile({
          type: "asset",
          fileName: basename(target),
          source: readFileSync(target),
        });
      });
    },
  };
}
