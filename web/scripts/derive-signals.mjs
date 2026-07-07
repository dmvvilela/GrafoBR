// Current-snapshot signals for the home/data pages, plus a lightweight diff
// against the previously generated _signals.json when one exists.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../public/data");

function brl(value) {
  return Number(value ?? 0);
}

function projectScore(project) {
  const signals = new Set(project.signals ?? []);
  return (
    (signals.has("paralisada") ? 3_000_000_000 : 0) +
    (signals.has("atrasada") ? 2_000_000_000 : 0) +
    (signals.has("baixo_avanco") ? 1_000_000_000 : 0) +
    brl(project.valorPrevisto) +
    brl(project.diasAtraso) * 1000
  );
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(path.join(dir, file), "utf8"));
  } catch {
    return fallback;
  }
}

const [meta, contracts, emendas, ceap, obras] = await Promise.all([
  readJson("_meta.json", null),
  readJson("_contract-ranking.json", []),
  readJson("_emenda-ranking.json", []),
  readJson("_ceap-ranking.json", []),
  readJson("_obras.json", null),
]);
const previous = await readJson("_signals.json", null);

const obraRows = [...(obras?.all ?? [])].toSorted(
  (a, b) => projectScore(b) - projectScore(a),
);

const payload = {
  generatedAt: new Date().toISOString(),
  snapshotGeneratedAt: meta?.generatedAt ?? null,
  note:
    "Sinais calculados a partir do snapshot atual; não são acusações.",
  topContracts: contracts.slice(0, 5).map((row) => ({
    kind: "contract",
    title: `${row.name} → ${row.company}`,
    href: `/politico/${row.id}`,
    value: row.value,
    context: row.org || "contratos federais",
  })),
  topEmendas: emendas.slice(0, 5).map((row) => ({
    kind: "emenda",
    title: row.name,
    href: `/politico/${row.id}`,
    value: row.empenhado,
    context: row.topArea || "emendas individuais",
  })),
  topObras: obraRows.slice(0, 5).map((row) => ({
    kind: "obra",
    title: row.nome || `CIPI ${row.id}`,
    href: `/obras/${encodeURIComponent(row.id)}`,
    value: row.valorPrevisto ?? null,
    context: [row.uf, row.signals?.join(", ")].filter(Boolean).join(" · "),
  })),
  topCeap: ceap.slice(0, 5).map((row) => ({
    kind: "ceap",
    title: row.supplier,
    href: "/rankings",
    value: row.total,
    context: `${row.deputies} deputados · ${row.category}`,
  })),
};

function allItems(signals) {
  if (!signals) return [];
  return [
    ...(signals.topContracts ?? []),
    ...(signals.topEmendas ?? []),
    ...(signals.topObras ?? []),
    ...(signals.topCeap ?? []),
  ];
}

function keyOf(item) {
  return `${item.kind}|${item.href}|${item.title}`;
}

function summarizeChange(item, previousItem = null) {
  const delta =
    typeof item.value === "number" && typeof previousItem?.value === "number"
      ? Math.round(item.value - previousItem.value)
      : null;
  return {
    kind: item.kind,
    title: item.title,
    href: item.href,
    value: item.value ?? null,
    previousValue: previousItem?.value ?? null,
    delta,
    context: item.context ?? null,
  };
}

function buildChanges(prev, current) {
  const prevItems = allItems(prev);
  const currentItems = allItems(current);
  const prevByKey = new Map(prevItems.map((item) => [keyOf(item), item]));
  const currentByKey = new Map(currentItems.map((item) => [keyOf(item), item]));

  const added = currentItems
    .filter((item) => !prevByKey.has(keyOf(item)))
    .map((item) => summarizeChange(item));
  const removed = prevItems
    .filter((item) => !currentByKey.has(keyOf(item)))
    .map((item) => summarizeChange(item));
  const changed = currentItems
    .map((item) => {
      const old = prevByKey.get(keyOf(item));
      if (!old) return null;
      if (typeof item.value !== "number" || typeof old.value !== "number") return null;
      const delta = Math.round(item.value - old.value);
      if (delta === 0) return null;
      return summarizeChange(item, old);
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));

  return {
    generatedAt: current.generatedAt,
    previousGeneratedAt: prev?.generatedAt ?? null,
    snapshotGeneratedAt: current.snapshotGeneratedAt ?? null,
    hasPrevious: Boolean(prev),
    note: prev
      ? "Mudanças calculadas contra o _signals.json gerado anteriormente neste diretório."
      : "Sem snapshot anterior para comparação; esta é a linha de base.",
    added: added.slice(0, 20),
    removed: removed.slice(0, 20),
    changed: changed.slice(0, 20),
  };
}

const changes = buildChanges(previous, payload);

await writeFile(path.join(dir, "_signals.json"), JSON.stringify(payload), "utf8");
await writeFile(path.join(dir, "_changes.json"), JSON.stringify(changes), "utf8");
console.log(
  `[derive-signals] ${payload.topContracts.length} contracts, ${payload.topEmendas.length} emendas, ${payload.topObras.length} obras; changes +${changes.added.length}/-${changes.removed.length}/~${changes.changed.length}`,
);
