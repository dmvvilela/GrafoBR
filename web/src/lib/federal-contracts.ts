import type {
  StateContract,
  ContractEvent,
  ContractHistory,
  ContractRefresh,
} from "./state-contracts";

export type FederalContract = Omit<StateContract, "uf"> & {
  uf: string;
  sphere: "F";
  agencyId: string;
};
export type FederalEvent = Omit<
  ContractEvent,
  "before" | "after" | "fields"
> & {
  before: FederalContract | null;
  after: FederalContract | null;
  fields: (keyof FederalContract)[];
};
export type FederalSnapshot = {
  schemaVersion: 1;
  scope: "F";
  version: string;
  fetchedAt: string;
  period: { start: string; end: string; basis: "publication" };
  source: string;
  collection: {
    mode: "fresh" | "validated-cache";
    startedAt: string;
    finishedAt: string;
  };
  coverage: {
    states: string[];
    nationalRecordsChecked: number;
    federalRecordsChecked: number;
    excluded: Record<string, number>;
    days: {
      date: string;
      pages: number;
      nationalRecords: number;
      federalRecords: number;
    }[];
  };
  suppliers: { id: string; name: string; aliases: string[] }[];
  contracts: FederalContract[];
  history: Omit<ContractHistory, "events"> & { events: FederalEvent[] };
  refresh: ContractRefresh;
};
export type FederalFilters = {
  uf: string;
  power: string;
  org: string;
  q: string;
  sort: string;
};
const searchable = (v: string) =>
  v
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export function filterFederalContracts(
  rows: FederalContract[],
  filters: FederalFilters,
) {
  const q = searchable(filters.q.trim());
  return rows
    .filter(
      (c) =>
        c.sphere === "F" &&
        (!filters.uf || c.uf === filters.uf) &&
        (!filters.power || c.power === filters.power) &&
        (!filters.org || c.agencyId === filters.org) &&
        (!q ||
          searchable(
            `${c.supplierName} ${c.agency} ${c.unit} ${c.object} ${c.number}`,
          ).includes(q)),
    )
    .sort(
      (a, b) =>
        (filters.sort === "date"
          ? b.publishedAt.localeCompare(a.publishedAt)
          : b.initialValue - a.initialValue) || a.id.localeCompare(b.id),
    );
}
export function summarizeFederalContracts(input: FederalContract[]) {
  const rows = input.filter((c) => c.sphere === "F");
  const suppliers = new Map<
    string,
    { id: string; name: string; count: number; total: number }
  >();
  const agencies = new Map<
    string,
    { id: string; name: string; count: number; total: number }
  >();
  for (const c of rows) {
    for (const [map, id, name] of [
      [suppliers, c.supplierId, c.supplierName],
      [agencies, c.agencyId, c.agency],
    ] as const) {
      const row = map.get(id) ?? { id, name, count: 0, total: 0 };
      row.count++;
      row.total += c.initialValue;
      map.set(id, row);
    }
  }
  return {
    count: rows.length,
    total: rows.reduce((n, c) => n + c.initialValue, 0),
    supplierCount: suppliers.size,
    agencyCount: agencies.size,
    suppliers: [...suppliers.values()]
      .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))
      .slice(0, 5),
    agencies: [...agencies.values()]
      .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))
      .slice(0, 5),
  };
}
export function federalHistoryBatches(history: FederalSnapshot["history"]) {
  const batches = new Map<
    number,
    {
      sequence: number;
      observedAt: string;
      added: number;
      removed: number;
      changed: number;
    }
  >();
  for (const e of history.events) {
    const batch = batches.get(e.sequence) ?? {
      sequence: e.sequence,
      observedAt: e.observedAt,
      added: 0,
      removed: 0,
      changed: 0,
    };
    batch[e.kind]++;
    batches.set(e.sequence, batch);
  }
  return [...batches.values()].sort((a, b) => b.sequence - a.sequence);
}
export function assertFederalSnapshot(data: FederalSnapshot) {
  if (
    data.schemaVersion !== 1 ||
    data.scope !== "F" ||
    data.contracts.some((c) => c.sphere !== "F")
  ) {
    throw new Error("Invalid federal scope");
  }
}
