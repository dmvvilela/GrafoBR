import { createHash } from "node:crypto";

export const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

const kinds = {
  doacao: "Doações",
  socio: "Vínculos societários",
  contrato: "Contratos",
  despesa: "Despesas de cota",
  emenda: "Emendas",
  other: "Outros vínculos",
  parente: "Vínculos familiares",
};

// Compare business content, not regenerated opaque IDs, layout or timestamps.
export function graphRecords(entry, ego) {
  const nodes = new Map(ego.nodes.map((node) => [node.id, node]));
  const groups = new Map();
  for (const edge of ego.links) {
    const items = groups.get(edge.connectionType) ?? [];
    items.push([
      nodes.get(edge.source)?.name,
      nodes.get(edge.source)?.category,
      nodes.get(edge.target)?.name,
      nodes.get(edge.target)?.category,
      edge.description,
    ]);
    groups.set(edge.connectionType, items);
  }
  return [...groups.entries()].map(([kind, edges]) => ({
    key: `profile:${entry.id}:${kind}`,
    kind,
    politicianId: entry.id,
    title: `${kinds[kind] ?? kind} · ${entry.name}`,
    href: `/politico/${entry.id}`,
    count: edges.length,
    fingerprint: digest(
      edges.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    ),
    context: [entry.party, entry.uf].filter(Boolean).join(" · "),
  }));
}

export function compareRecords(previous, current) {
  const old = new Map(previous.map((r) => [r.key, r]));
  const next = new Map(current.map((r) => [r.key, r]));
  const events = [];
  for (const row of current) {
    const before = old.get(row.key);
    if (
      before?.fingerprint === row.fingerprint &&
      before?.title === row.title &&
      before?.context === row.context
    )
      continue;
    const { fingerprint, ...publicRow } = row;
    events.push({
      ...publicRow,
      mode: before ? "changed" : "added",
      previousCount: before?.count ?? null,
    });
  }
  for (const row of previous) {
    if (next.has(row.key)) continue;
    const { fingerprint, ...publicRow } = row;
    events.push({ ...publicRow, mode: "removed", previousCount: row.count });
  }
  return events.sort((a, b) => a.key.localeCompare(b.key));
}

export function advanceHistory(
  previous,
  history,
  records,
  observedAt,
  snapshotGeneratedAt,
) {
  const sorted = records.toSorted((a, b) => a.key.localeCompare(b.key));
  const hash = digest(sorted);
  if (previous?.hash === hash)
    return { state: previous, history, unchanged: true };
  const events = previous ? compareRecords(previous.records, sorted) : [];
  const batch = {
    id: digest([previous?.hash ?? null, hash, observedAt]),
    observedAt,
    previousObservedAt: previous?.observedAt ?? null,
    snapshotGeneratedAt,
    baseline: !previous,
    events,
  };
  return {
    unchanged: false,
    state: { hash, observedAt, records: sorted },
    history: {
      version: 1,
      batches: [batch, ...(history?.batches ?? [])].slice(0, 30),
    },
  };
}
