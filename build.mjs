import * as esbuild from "esbuild";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const outfile = path.join(__dirname, "dist", "plugin.bundle.js");

await esbuild.build({
  entryPoints: [path.join(__dirname, "src", "index.ts")],
  outfile,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["openclaw", "openclaw/plugin-sdk/plugin-entry"],
  sourcemap: true,
  minify: false,
});

console.log("Bundled to:", outfile);