// "Maiores autores de emendas" — ranks deputies by the individual-amendment money
// they directed (emendas individuais, current mandate). Reads the synced ego files,
// sums each deputy's emenda edges, and writes public/data/_emenda-trails.json sorted
// by amount empenhado. Runs after sync-data.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../public/data");

function brl(s, kw) {
  const m = s && s.match(new RegExp(`R\\$\\s*([\\d.]+,\\d{2})\\s*${kw}`));
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : 0;
}

let meta = {};
try {
  const idx = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
  meta = Object.fromEntries(idx.map((e) => [e.id, { party: e.party, uf: e.uf }]));
} catch {}

const files = (await readdir(dir)).filter((f) => /^\d+\.json$/.test(f));
const trails = [];
for (const f of files) {
  const ego = JSON.parse(await readFile(path.join(dir, f), "utf8"));
  const byId = new Map(ego.nodes.map((n) => [n.id, n]));
  let empenhado = 0;
  let pago = 0;
  let top = { name: null, value: 0 };
  let areas = 0;
  for (const l of ego.links) {
    if (l.connectionType !== "emenda") continue;
    areas++;
    const emp = brl(l.description, "empenhado");
    empenhado += emp;
    pago += brl(l.description, "pago");
    const dest = [byId.get(l.target), byId.get(l.source)].find(
      (n) => n && n.category === "destino",
    );
    if (dest && emp > top.value) top = { name: dest.name, value: emp };
  }
  if (empenhado <= 0) continue;
  trails.push({
    id: ego.meta.egoId,
    name: ego.meta.egoName,
    party: meta[ego.meta.egoId]?.party ?? null,
    uf: meta[ego.meta.egoId]?.uf ?? null,
    empenhado: Math.round(empenhado),
    pago: Math.round(pago),
    topArea: top.name,
    areas,
  });
}
trails.sort((a, b) => b.empenhado - a.empenhado);
await writeFile(path.join(dir, "_emenda-trails.json"), JSON.stringify(trails.slice(0, 9)), "utf8");
// full ranking (all deputies) for the /rankings page + OG card lookup
await writeFile(path.join(dir, "_emenda-ranking.json"), JSON.stringify(trails), "utf8");

console.log(`[derive-emendas] ${trails.length} deputies with emendas; top:`);
for (const t of trails.slice(0, 9))
  console.log(`  R$ ${t.empenhado.toLocaleString("pt-BR")}  ${t.name} [${t.topArea}]`);
