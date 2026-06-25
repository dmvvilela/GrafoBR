// Copies the pipeline's output (repo-root /data/*.json) into web/public/data so the
// static site can read it at build time. Runs automatically before dev/build.
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../../data"); // repo-root /data
const outDir = path.resolve(here, "../public/data"); // web/public/data

if (!existsSync(srcDir)) {
  console.warn(`[sync-data] no source dir at ${srcDir} — skipping`);
  process.exit(0);
}

await mkdir(outDir, { recursive: true });
const buildOnly = new Set(["_emenda-destinations.json"]);
const files = (await readdir(srcDir)).filter(
  (f) => f.endsWith(".json") && !buildOnly.has(f),
);
await Promise.all(
  files.map((f) => copyFile(path.join(srcDir, f), path.join(outDir, f))),
);
console.log(`[sync-data] copied ${files.length} json file(s) -> web/public/data`);
