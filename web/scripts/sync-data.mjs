// Copies the pipeline's output (repo-root /data/*.json) into web/public/data so the
// static site can read it at build time. Runs automatically before dev/build.
import { copyFile, mkdir, readdir, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "../../data"); // repo-root /data
const outDir = path.resolve(here, "../public/data"); // web/public/data

await mkdir(outDir, { recursive: true });
// Election and state-spending imports are independent of a full core rebuild. This works in
// a clean checkout, where only the committed public core snapshot exists.
for (const file of [
  "_elections-2026.json",
  "_state-spending.json",
  "_state-contracts.json",
]) {
  if (
    file === "_state-contracts.json" &&
    existsSync(path.join(srcDir, file)) &&
    existsSync(path.join(outDir, file))
  ) {
    const candidate = JSON.parse(
      await readFile(path.join(srcDir, file), "utf8"),
    );
    const published = JSON.parse(
      await readFile(path.join(outDir, file), "utf8"),
    );
    if (
      published.history &&
      (!candidate.history ||
        candidate.history.baselineVersion !==
          published.history.baselineVersion ||
        candidate.history.sequence < published.history.sequence ||
        candidate.fetchedAt < published.fetchedAt ||
        JSON.stringify(
          candidate.history.events.slice(0, published.history.events.length),
        ) !== JSON.stringify(published.history.events))
    )
      throw new Error(
        "Refusing to overwrite PNCP history with an older or unrelated snapshot",
      );
  }
  if (existsSync(path.join(srcDir, file)))
    await copyFile(path.join(srcDir, file), path.join(outDir, file));
}

if (!existsSync(path.join(srcDir, "index.json"))) {
  console.warn(
    `[sync-data] no complete pipeline snapshot at ${srcDir} — keeping committed data`,
  );
  process.exit(0);
}

const buildOnly = new Set([
  "_emenda-destinations.json",
  "_updates.json",
  "_updates-state.json",
  "_press.json",
  "_signals.json",
  "_changes.json",
]);
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
