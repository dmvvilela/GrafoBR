// Per-politician "related" index: other deputies/senators that share the most
// donors, companies, or suppliers (via _entities.json). Runs after derive-entities.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../public/data");

const CATEGORIES = new Set(["donor", "company", "supplier"]);
const MAX_RELATED = 10;
const MAX_ENTITIES = 3;

const PARTY_HINTS = [
  "partido", "nacional", "estadual", "municipal", "diretorio", "comissao provisoria",
  "fundo partidario", "fundo especial", "republicanos", "progressistas", "cidadania",
  "uniao brasil", "movimento democratico", "podemos", "solidariedade", "avante", "patriota",
];

function norm(s) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function isParty(name) {
  const n = norm(name);
  if (!n || n === "nulo") return true;
  if (/\bbr\b/.test(n) && /\bbrasil\b/.test(n)) return true;
  return PARTY_HINTS.some((h) => n.includes(h));
}

const entities = JSON.parse(await readFile(path.join(dir, "_entities.json"), "utf8"));
const files = (await readdir(dir)).filter((f) => /^\d+\.json$/.test(f));

const out = {};
let withRelated = 0;

for (const f of files) {
  const ego = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  const depId = String(ego.meta?.egoId ?? f.replace(".json", ""));
  // otherId -> { id, name, party, uf, shared, entities: [{name, category}] }
  const scores = new Map();

  for (const n of ego.nodes) {
    if (!CATEGORIES.has(n.category)) continue;
    if (n.category === "donor" && isParty(n.name)) continue;
    const ent = entities[n.name];
    if (!ent || ent.count < 2) continue;

    for (const d of ent.deputies) {
      if (String(d.id) === depId) continue;
      const key = String(d.id);
      if (!scores.has(key)) {
        scores.set(key, {
          id: d.id,
          name: d.name,
          party: d.party ?? null,
          uf: d.uf ?? null,
          shared: 0,
          entities: [],
        });
      }
      const rec = scores.get(key);
      rec.shared += 1;
      rec.entities.push({ name: ent.name, category: ent.category });
    }
  }

  const related = [...scores.values()]
    .sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, MAX_RELATED)
    .map((r) => ({
      ...r,
      entities: [...new Set(r.entities.map((e) => e.name))].slice(0, MAX_ENTITIES),
    }));

  if (related.length > 0) {
    withRelated += 1;
    out[depId] = related;
  }
}

await writeFile(path.join(dir, "_related.json"), JSON.stringify(out), "utf8");
console.log(`[derive-related] ${withRelated} politicians with shared ties`);
