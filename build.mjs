import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { context } from "esbuild";
import { htmlPlugin } from "@craftamap/esbuild-plugin-html";

import manifest from "./manifest.json" with { type: "json" };
import pkg from "./package.json" with { type: "json" };

const watch = process.env.npm_lifecycle_event === "start";
const outdir = "dist";
const title = "Snowplow Inspector";

const ctx = await context({
  entryPoints: [
    "src/extension.tsx",
    "src/devtools.ts",
    "src/options.tsx",
    "src/popup.tsx",
    { in: "LICENSE.md", out: "LICENSE" },
    { in: "res/devbar.png", out: "assets/devbar" },
    { in: "res/icon-16.png", out: "assets/icon-16" },
    { in: "res/icon-48.png", out: "assets/icon-48" },
    { in: "res/icon-128.png", out: "assets/icon-128" },
    { in: "res/icon.png", out: "assets/icon" },
    { in: "res/ngrok.png", out: "assets/ngrok" },
  ],
  bundle: true,
  minify: !watch,
  sourcemap: watch && "inline",
  outdir,
  assetNames: "assets/[name]-[hash]",
  loader: {
    ".svg": "file",
    ".png": "copy",
    ".md": "copy",
    ".woff": "file",
    ".woff2": "file",
  },
  alias: {
    "@res": "./res",
  },
  plugins: [
    {
      name: "manifest",
      setup(build) {
        build.onEnd(async () => {
          const { author, description, version } = pkg;
          const m = Object.assign(manifest, {
            author,
            description,
            name: title,
            version,
          });
          await writeFile(
            join(outdir, "manifest.json"),
            JSON.stringify(m, null, 2),
          );
        });
      },
    },
    htmlPlugin({
      files: [
        {
          entryPoints: ["src/extension.tsx"],
          filename: "panel.html",
          title,
        },
        {
          entryPoints: ["src/devtools.ts"],
          filename: "devtools.html",
          title,
        },
        {
          entryPoints: ["src/options.tsx"],
          filename: "options.html",
          title,
        },
        {
          entryPoints: ["src/popup.tsx"],
          filename: "popup.html",
          title,
        },
      ],
    }),
  ],
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
