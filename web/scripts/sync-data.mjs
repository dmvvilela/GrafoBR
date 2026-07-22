// Copies the pipeline's output (repo-root /data/*.json) into web/public/data so the
// static site can read it at build time. Runs automatically before dev/build.
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../../data"); // repo-root /data
const outDir = path.resolve(here, "../public/data"); // web/public/data

if (!existsSync(path.join(srcDir, "index.json"))) {
  console.warn(`[sync-data] no complete pipeline snapshot at ${srcDir} — keeping committed data`);
  process.exit(0);
}

await mkdir(outDir, { recursive: true });
const buildOnly = new Set(["_emenda-destinations.json"]);
const files = (await readdir(srcDir)).filter(
  (f) => f.endsWith(".json") && !buildOnly.has(f),
);
const sourceProfiles = new Set(files.filter((f) => /^\d+\.json$/.test(f)));
const staleProfiles = (await readdir(outDir)).filter(
  (f) => /^\d+\.json$/.test(f) && !sourceProfiles.has(f),
);
await Promise.all(staleProfiles.map((f) => rm(path.join(outDir, f))));
await Promise.all(
  files.map((f) => copyFile(path.join(srcDir, f), path.join(outDir, f))),
);
console.log(
  `[sync-data] copied ${files.length} json file(s), removed ${staleProfiles.length} stale profile(s) -> web/public/data`,
);
