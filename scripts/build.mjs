import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  format: "esm",
  target: "es2022",
  outfile: "app.js",
});

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await Promise.all([
  cp("index.html", "dist/index.html"),
  cp("styles.css", "dist/styles.css"),
  cp("app.js", "dist/app.js"),
]);
