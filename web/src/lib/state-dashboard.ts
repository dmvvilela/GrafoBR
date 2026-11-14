import type { StateContractsSnapshot, StateContract } from "./state-contracts";

export const DASHBOARD_STATES = {
  sp: "São Paulo",
  mg: "Minas Gerais",
} as const;
export type DashboardSlug = keyof typeof DASHBOARD_STATES;
export const isDashboardSlug = (value: string): value is DashboardSlug =>
  Object.hasOwn(DASHBOARD_STATES, value);

export function summarizeStateContracts(
  data: StateContractsSnapshot,
  uf: string,
) {
  if (!data.coverage.states.includes(uf)) return null;
  const rows = data.contracts.filter((c) => c.uf === uf);
  const supplierNames = new Map(data.suppliers.map((s) => [s.id, s.name]));
  const suppliers = new Map<
    string,
    { id: string; name: string; count: number; value: number }
  >();
  const counts = new Map<string, number>();
  for (const c of rows) {
    const supplier = suppliers.get(c.supplierId) ?? {
      id: c.supplierId,
      name: supplierNames.get(c.supplierId) ?? c.supplierName,
      count: 0,
      value: 0,
    };
    supplier.count++;
    supplier.value += c.initialValue;
    suppliers.set(c.supplierId, supplier);
    const date = c.publishedAt.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  const total = rows.reduce((sum, c) => sum + c.initialValue, 0);
  const leaders = [...suppliers.values()]
    .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((s) => ({ ...s, share: total > 0 ? (s.value / total) * 100 : null }));
  // Zero is valid only on days explicitly covered by the completed import.
  const days = data.coverage.days
    .map((day) => ({ date: day.date, count: counts.get(day.date) ?? 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const recent: StateContract[] = [...rows]
    .sort(
      (a, b) =>
        b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id),
    )
    .slice(0, 6);
  return {
    count: rows.length,
    supplierCount: suppliers.size,
    agencyCount: new Set(rows.map((c) => c.agency)).size,
    total,
    leaders,
    days,
    recent,
    period: data.period,
    version: data.version,
    fetchedAt: data.fetchedAt,
  };
}
export type StateContractSummary = NonNullable<
  ReturnType<typeof summarizeStateContracts>
>;
export type DashboardSelection = {
  year: number;
  unit: "perCapita" | "total" | "share";
};
export function dashboardPath(
  slug: DashboardSlug,
  selection: DashboardSelection,
  spendingVersion: string,
  contractsVersion: string,
) {
  return `/meu-estado/${slug}?${new URLSearchParams({ year: String(selection.year), unit: selection.unit, sv: spendingVersion, cv: contractsVersion })}`;
}
export function readDashboardSelection(
  params: URLSearchParams,
  years: number[],
  spendingVersion: string,
  contractsVersion: string,
) {
  const year = years.includes(Number(params.get("year")))
    ? Number(params.get("year"))
    : Math.max(...years);
  const rawUnit = params.get("unit");
  const unit: DashboardSelection["unit"] =
    rawUnit === "total" || rawUnit === "share" ? rawUnit : "perCapita";
  return {
    selection: { year, unit },
    corrected:
      (params.has("year") && params.get("year") !== String(year)) ||
      (params.has("unit") && params.get("unit") !== unit),
    stale:
      (params.has("sv") && params.get("sv") !== spendingVersion) ||
      (params.has("cv") && params.get("cv") !== contractsVersion),
  };
}
