// Cross-links deputies by shared donors. Reads the synced ego-networks, finds donors
// that appear for 2+ deputies, and writes public/data/_shared-donors.json keyed by
// normalized donor name -> { name, deputies: [{id, name}] }. Runs after sync-data.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../public/data");

function norm(s) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

const files = (await readdir(dir)).filter((f) => /^\d+\.json$/.test(f));
const byDonor = new Map(); // normName -> { name, deputies: Map(id->name) }

for (const f of files) {
  const ego = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  const depId = ego.meta?.egoId;
  const depName = ego.meta?.egoName;
  for (const n of ego.nodes) {
    if (n.category !== "donor") continue;
    const k = norm(n.name);
    if (!k) continue;
    if (!byDonor.has(k)) byDonor.set(k, { name: n.name, deputies: new Map() });
    byDonor.get(k).deputies.set(depId, depName);
  }
}

const shared = {};
for (const [k, v] of byDonor) {
  if (v.deputies.size >= 2) {
    shared[k] = {
      name: v.name,
      deputies: [...v.deputies].map(([id, name]) => ({ id, name })),
    };
  }
}

await writeFile(path.join(dir, "_shared-donors.json"), JSON.stringify(shared), "utf8");

const top = Object.values(shared)
  .sort((a, b) => b.deputies.length - a.deputies.length)
  .slice(0, 10);
console.log(`[derive-shared] ${Object.keys(shared).length} donors funded 2+ deputies`);
for (const s of top) console.log(`  ${s.deputies.length}x  ${s.name}`);
