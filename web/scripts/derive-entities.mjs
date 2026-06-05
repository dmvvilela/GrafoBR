// Cross-entity index: for every donor / company / supplier that is tied to 2+
// deputies, list those deputies (with the amount, when the edge carries one).
// This is what turns 512 isolated ego-views into an investigative graph — click a
// supplier and see every deputy that pays it. Writes public/data/_entities.json
// keyed by the exact node name (names are byte-identical across ego files because
// they come from the same source rows, so no normalization drift). Supersedes
// derive-shared.mjs (donors are included here, party committees excluded).
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../public/data");

const CATEGORIES = new Set(["donor", "company", "supplier"]);
const MAX_DEPUTIES = 40; // cap each entity's list; keep the true count separately

function norm(s) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

// Party committees / #NULO dominate the donor list and aren't a real "shared" tie.
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

function brl(desc) {
  const m = desc && desc.match(/R\$\s*([\d.]+,\d{2})/);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : 0;
}

let meta = {};
try {
  const idx = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
  meta = Object.fromEntries(idx.map((e) => [e.id, { party: e.party, uf: e.uf }]));
} catch {}

const files = (await readdir(dir)).filter((f) => /^\d+\.json$/.test(f));
// name -> { name, category, deputies: Map(id -> {id,name,party,uf,amount}) }
const byName = new Map();

for (const f of files) {
  const ego = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  const depId = ego.meta?.egoId;
  const depName = ego.meta?.egoName;
  for (const n of ego.nodes) {
    if (!CATEGORIES.has(n.category)) continue;
    if (n.category === "donor" && isParty(n.name)) continue;
    const link = ego.links.find((l) => l.source === n.id || l.target === n.id);
    const amount = link ? brl(link.description) : 0;
    if (!byName.has(n.name))
      byName.set(n.name, { name: n.name, category: n.category, deputies: new Map() });
    const rec = byName.get(n.name);
    // a deputy might touch the same entity once; keep the larger amount if repeated
    const prev = rec.deputies.get(depId);
    if (!prev || amount > prev.amount)
      rec.deputies.set(depId, {
        id: depId,
        name: depName,
        party: meta[depId]?.party ?? null,
        uf: meta[depId]?.uf ?? null,
        amount,
      });
  }
}

const out = {};
let kept = 0;
for (const [name, rec] of byName) {
  if (rec.deputies.size < 2) continue;
  kept++;
  const deputies = [...rec.deputies.values()].sort((a, b) => b.amount - a.amount);
  out[name] = {
    name: rec.name,
    category: rec.category,
    count: deputies.length,
    deputies: deputies.slice(0, MAX_DEPUTIES),
  };
}

await writeFile(path.join(dir, "_entities.json"), JSON.stringify(out), "utf8");
console.log(`[derive-entities] ${kept} entities tied to 2+ deputies`);
const byCat = {};
for (const e of Object.values(out)) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
console.log("  by category:", byCat);
const top = Object.values(out).sort((a, b) => b.count - a.count).slice(0, 6);
for (const e of top) console.log(`  ${e.count}x  ${e.category}  ${e.name}`);
