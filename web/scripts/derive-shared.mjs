// Cross-links deputies by shared PRIVATE donors. Reads the synced ego-networks, finds
// non-party donors that appear for 2+ deputies, and writes public/data/_shared-donors.json
// keyed by normalized donor name -> { name, deputies: [{id, name}] }. Runs after sync-data.
//
// Party committees (PT, PL, ...) and #NULO dominate the raw shared list and are noise —
// they're excluded here so the "também doou para" feature only surfaces real signal.
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

const PARTY_HINTS = [
  "partido", "nacional", "estadual", "municipal", "diretorio", "comissao provisoria",
  "fundo partidario", "fundo especial", "republicanos", "progressistas", "cidadania",
  "uniao brasil", "movimento democratico", "podemos", "solidariedade", "avante", "patriota",
];
function isParty(name) {
  const n = norm(name);
  if (!n || n === "nulo") return true;
  if (/\bbr\b/.test(n) && /\bbrasil\b/.test(n)) return true;
  return PARTY_HINTS.some((h) => n.includes(h));
}

const files = (await readdir(dir)).filter((f) => /^\d+\.json$/.test(f));
const byDonor = new Map(); // normName -> { name, deputies: Map(id->name) }

for (const f of files) {
  const ego = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  const depId = ego.meta?.egoId;
  const depName = ego.meta?.egoName;
  for (const n of ego.nodes) {
    if (n.category !== "donor" || isParty(n.name)) continue;
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
console.log(`[derive-shared] ${Object.keys(shared).length} PRIVATE donors funded 2+ deputies`);
for (const s of top) console.log(`  ${s.deputies.length}x  ${s.name}`);
