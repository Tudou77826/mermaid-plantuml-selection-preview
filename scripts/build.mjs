import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

await build({
  entryPoints: {
    action: path.join(root, "src", "action.js"),
    preview: path.join(root, "src", "preview.js"),
    background: path.join(root, "src", "background.js"),
  },
  bundle: true,
  minify: true,
  sourcemap: false,
  outdir: output,
  format: "esm",
  target: "chrome120",
  legalComments: "none",
});

await build({
  entryPoints: [path.join(root, "src", "plantuml-overlay.js")],
  bundle: true,
  minify: true,
  sourcemap: false,
  outfile: path.join(output, "plantuml-overlay.js"),
  format: "iife",
  target: "chrome120",
  legalComments: "none",
});

await build({
  entryPoints: [path.join(root, "src", "overlay.js")],
  bundle: true,
  minify: true,
  sourcemap: false,
  outfile: path.join(output, "overlay.js"),
  format: "iife",
  target: "chrome120",
  legalComments: "none",
});

await Promise.all([
  cp(path.join(root, "manifest.json"), path.join(output, "manifest.json")),
  cp(path.join(root, "src", "preview.html"), path.join(output, "preview.html")),
  cp(path.join(root, "src", "preview.css"), path.join(output, "preview.css")),
  cp(path.join(root, "src", "action.html"), path.join(output, "action.html")),
  cp(path.join(root, "src", "action.css"), path.join(output, "action.css")),
  cp(path.join(root, "src", "overlay-host.html"), path.join(output, "overlay-host.html")),
  cp(path.join(root, "assets", "icons"), path.join(output, "icons"), { recursive: true }),
  cp(
    path.join(root, "node_modules", "@plantuml", "core", "viz-global.js"),
    path.join(output, "viz-global.js"),
  ),
]);

console.log(`Built extension in ${output}`);
