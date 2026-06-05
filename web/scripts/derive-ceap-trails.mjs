// "Money out" trails from CEAP (cota parlamentar). A naive ranking of CEAP
// suppliers is dominated by airlines / telecom / fuel — mundane expenses every
// deputy has. The interesting signal is the soft-spending vectors: publicity
// agencies, vehicle/aircraft rental, consultancies. We whitelist those, aggregate
// each supplier across deputies (total received + how many deputies fund it), and
// write public/data/_ceap-trails.json. Runs after sync-data.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../public/data");

function norm(s) {
  return (s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Keep only the expense types that are genuine "where did the money go" vectors.
// Each entry: keyword (matched against the normalized expense type) -> short label.
const VECTORS = [
  { kw: "divulgacao", label: "Divulgação" },
  { kw: "consultoria", label: "Consultoria" },
  { kw: "pesquisa", label: "Pesquisa" },
  { kw: "locacao ou fretamento de veiculos", label: "Locação de veículos" },
  { kw: "locacao ou fretamento de aeronaves", label: "Fretamento de aeronaves" },
  { kw: "locacao ou fretamento de embarcacoes", label: "Fretamento de embarcações" },
  { kw: "locacao de imoveis", label: "Locação de imóvel" },
];
function vector(type) {
  const n = norm(type);
  return VECTORS.find((v) => n.includes(v.kw)) ?? null;
}

const reTotal = /total de R\$\s*([\d.]+,\d{2})/;
const reType = /tipo:\s*([^;)]+)/;

const files = (await readdir(dir)).filter((f) => /^\d+\.json$/.test(f));
// normalized supplier name -> { name, total, deputies:Set, types:Map(label->amount) }
const bySupplier = new Map();

for (const f of files) {
  const ego = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  const egoId = ego.meta?.egoId;
  const byId = new Map(ego.nodes.map((n) => [n.id, n]));
  for (const l of ego.links) {
    if (l.connectionType !== "despesa") continue;
    const v = vector((l.description.match(reType) ?? [])[1]);
    if (!v) continue;
    const sup = [byId.get(l.target), byId.get(l.source)].find(
      (n) => n && (n.category === "supplier" || n.category === "company"),
    );
    if (!sup) continue;
    const m = l.description.match(reTotal);
    const amount = m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : 0;
    if (amount <= 0) continue;

    const key = norm(sup.name);
    if (!bySupplier.has(key))
      bySupplier.set(key, { name: sup.name, total: 0, deputies: new Set(), types: new Map() });
    const rec = bySupplier.get(key);
    rec.total += amount;
    rec.deputies.add(egoId);
    rec.types.set(v.label, (rec.types.get(v.label) ?? 0) + amount);
  }
}

const trails = [...bySupplier.values()]
  .map((r) => ({
    supplier: r.name,
    total: Math.round(r.total),
    deputies: r.deputies.size,
    category: [...r.types.entries()].sort((a, b) => b[1] - a[1])[0][0],
  }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 9);

await writeFile(path.join(dir, "_ceap-trails.json"), JSON.stringify(trails), "utf8");
console.log(`[derive-ceap-trails] top ${trails.length} CEAP vectors`);
for (const t of trails)
  console.log(`  R$ ${t.total.toLocaleString("pt-BR")}  ${t.deputies} dep  ${t.supplier} [${t.category}]`);
