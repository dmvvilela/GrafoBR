// Cross-entity index: for every donor / company / supplier that is tied to 2+
// deputies, list those deputies (with the amount, when the edge carries one).
// This is what turns 512 isolated ego-views into an investigative graph — click a
// supplier and see every deputy that pays it. Writes public/data/_entities.json
// keyed by the pipeline-issued opaque entityId. Display names are never identity
// keys: two people/companies can share a name, and one entity can have variants.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../public/data");

const CATEGORIES = new Set(["donor", "company", "supplier"]);

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

const idx = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
const meta = Object.fromEntries(idx.map((e) => [e.id, { party: e.party, uf: e.uf }]));
const files = idx.map((entry) => `${entry.id}.json`);
// opaque entityId -> { id, name, category, deputies: Map(...) }
const byId = new Map();

for (const f of files) {
  const ego = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  const depId = ego.meta?.egoId;
  const depName = ego.meta?.egoName;
  for (const n of ego.nodes) {
    if (!CATEGORIES.has(n.category)) continue;
    if (!n.entityId) continue;
    if (n.category === "donor" && isParty(n.name)) continue;
    // a node can have several incident edges (e.g. socio with no value + despesa/
    // contrato with one); take the largest parsed amount, not just the first edge
    let amount = 0;
    for (const l of ego.links) {
      if (l.source === n.id || l.target === n.id)
        amount = Math.max(amount, brl(l.description));
    }
    if (!byId.has(n.entityId))
      byId.set(n.entityId, {
        id: n.entityId,
        name: n.name,
        category: n.category,
        deputies: new Map(),
      });
    const rec = byId.get(n.entityId);
    // Prefer Receita's company label when CEAP and QSA expose different names.
    if (n.category === "company" && rec.category !== "company") {
      rec.name = n.name;
      rec.category = "company";
    }
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
for (const [entityId, rec] of byId) {
  if (rec.deputies.size < 2) continue;
  kept++;
  const deputies = [...rec.deputies.values()].sort((a, b) => b.amount - a.amount);
  out[entityId] = {
    id: entityId,
    name: rec.name,
    category: rec.category,
    count: deputies.length,
    deputies,
  };
}

await writeFile(path.join(dir, "_entities.json"), JSON.stringify(out), "utf8");
console.log(`[derive-entities] ${kept} entities tied to 2+ deputies`);
const byCat = {};
for (const e of Object.values(out)) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
console.log("  by category:", byCat);
const top = Object.values(out).sort((a, b) => b.count - a.count).slice(0, 6);
for (const e of top) console.log(`  ${e.count}x  ${e.category}  ${e.name}`);
