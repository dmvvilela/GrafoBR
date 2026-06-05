// Computes the "money trail" highlights: deputies who co-own a company that won a
// federal contract (deputy -socio-> company -contrato-> contract). Writes
// public/data/_highlights.json, sorted by contract value. Runs after sync-data.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../public/data");

function parseBRL(s) {
  const m = s && s.match(/R\$\s*([\d.]+,\d{2})/);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : 0;
}
function parseOrg(s) {
  const m = s && s.match(/exemplo de órgão:\s*([^;)]+)/);
  return m ? m[1].trim() : "";
}

// party/uf from the index
let meta = {};
try {
  const idx = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
  meta = Object.fromEntries(idx.map((e) => [e.id, { party: e.party, uf: e.uf }]));
} catch {}

// Floor: keep the homepage credible. The socio->contrato chain is genuinely rare
// (a handful of verified leads); trivial amounts (and the R$0 sample row) just make
// the section look arbitrary next to the R$8M one. Full data still lives on each
// deputy page — this only governs the homepage highlights.
const MIN_CONTRACT_BRL = 25_000;

const files = (await readdir(dir)).filter((f) => /^\d+\.json$/.test(f));
const highlights = [];
for (const f of files) {
  const ego = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  const byId = new Map(ego.nodes.map((n) => [n.id, n]));
  for (const l of ego.links) {
    if (l.connectionType !== "contrato") continue;
    const company = [byId.get(l.source), byId.get(l.target)].find(
      (n) => n && n.category === "company",
    );
    if (!company) continue;
    const value = parseBRL(l.description);
    if (value < MIN_CONTRACT_BRL) continue;
    highlights.push({
      id: ego.meta.egoId,
      name: ego.meta.egoName,
      party: meta[ego.meta.egoId]?.party ?? null,
      uf: meta[ego.meta.egoId]?.uf ?? null,
      company: company.name,
      value,
      org: parseOrg(l.description),
    });
  }
}
highlights.sort((a, b) => b.value - a.value);
await writeFile(path.join(dir, "_highlights.json"), JSON.stringify(highlights), "utf8");

console.log(`[derive-highlights] ${highlights.length} money-trail chains`);
for (const h of highlights.slice(0, 8)) {
  console.log(`  R$ ${h.value.toLocaleString("pt-BR")}  ${h.name} -> ${h.company}`);
}
