import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { advanceHistory, digest, graphRecords } from "./lib/updates.mjs";

const dir = fileURLToPath(new URL("../public/data/", import.meta.url));
async function read(name, fallback) {
  try {
    return JSON.parse(await readFile(path.join(dir, name), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== undefined) return fallback;
    throw error;
  }
}
const index = await read("index.json");
const meta = await read("_meta.json", null);
const records = [];
for (const entry of index)
  records.push(...graphRecords(entry, await read(`${entry.id}.json`)));
const obras = await read("_obras.json", null);
for (const row of obras?.all ?? []) {
  records.push({
    key: `obra:${row.id}`,
    kind: "obra",
    title: row.nome || `Obra ${row.id}`,
    href: `/obras/${encodeURIComponent(row.id)}`,
    count: 1,
    context: [row.uf, ...(row.signals ?? [])].filter(Boolean).join(" · "),
    fingerprint: digest([
      row.nome,
      row.uf,
      row.situacao,
      row.valorPrevisto,
      row.percentualFisico,
      row.dataFinalPrevista,
      [...(row.signals ?? [])].sort(),
    ]),
  });
}
const elections = await read("_elections-2026.json", null);
for (const entry of elections?.entries ?? []) {
  records.push({
    key: `election:2026:${entry.politicianId}`,
    kind: "candidatura",
    politicianId: entry.politicianId,
    title: `Eleições 2026 · ${entry.name}`,
    href: `/politico/${entry.politicianId}#eleicoes`,
    count: 1,
    context: `${entry.office} · ${entry.uf}`,
    fingerprint: digest(entry),
  });
}
const previous = await read("_updates-state.json", null);
const history = await read("_updates.json", null);
if (Boolean(previous) !== Boolean(history))
  throw new Error(
    "Updates history/state must be restored together before deriving updates",
  );
const result = advanceHistory(
  previous,
  history,
  records,
  new Date().toISOString(),
  meta?.generatedAt ?? null,
);
if (!result.unchanged) {
  const profileIds = new Set(index.map((e) => e.id));
  const workPaths = new Set(
    (obras?.all ?? []).map((e) => `/obras/${encodeURIComponent(e.id)}`),
  );
  for (const batch of result.history.batches)
    for (const event of batch.events) {
      if (event.politicianId && !profileIds.has(event.politicianId))
        event.href = "/buscar";
      if (event.kind === "obra" && !workPaths.has(event.href))
        event.href = "/obras";
    }
  await writeFile(
    path.join(dir, "_updates.json"),
    JSON.stringify(result.history),
  );
  await writeFile(
    path.join(dir, "_updates-state.json"),
    JSON.stringify(result.state),
  );
}
console.log(
  `[derive-updates] ${records.length} records; ${result.unchanged ? "unchanged, history preserved" : "history updated"}`,
);
