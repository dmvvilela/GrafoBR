import type {
  ContractEvent,
  StateContract,
  StateContractsSnapshot,
} from "./state-contracts";
export const EVENT_LABELS = {
  added: "Entrou no recorte",
  changed: "Registro alterado",
  removed: "Não retornou na consulta",
};
export const FIELD_LABELS: Record<keyof StateContract, string> = {
  id: "Identificador",
  supplierId: "Fornecedor (identidade)",
  supplierName: "Nome do fornecedor",
  uf: "Estado",
  agency: "Órgão",
  unit: "Unidade",
  power: "Poder",
  number: "Número",
  year: "Ano",
  object: "Objeto",
  initialValue: "Valor inicial",
  signedAt: "Assinatura",
  startsAt: "Início da vigência",
  endsAt: "Fim da vigência",
  publishedAt: "Publicação na fonte",
  updatedAt: "Atualização na fonte",
  sourceUrl: "Registro oficial",
};
export function eventMatches(event: ContractEvent, key: string) {
  return [event.before, event.after].some(
    (c) => c && (key === `state:${c.uf}` || key === `supplier:${c.supplierId}`),
  );
}
export function allKnownContracts(
  data: StateContractsSnapshot,
): StateContract[] {
  const rows = new Map<string, StateContract>();
  for (const e of data.history?.events ?? [])
    for (const c of [e.before, e.after]) if (c) rows.set(c.id, c);
  for (const c of data.contracts) rows.set(c.id, c);
  return [...rows.values()];
}
export function allKnownSuppliers(data: StateContractsSnapshot) {
  const rows = new Map(data.suppliers.map((s) => [s.id, s]));
  for (const e of data.history?.events ?? [])
    for (const c of [e.before, e.after])
      if (c && !rows.has(c.supplierId))
        rows.set(c.supplierId, {
          id: c.supplierId,
          name: c.supplierName,
          aliases: [c.supplierName],
          connections: [],
        });
  return [...rows.values()];
}
export type Follow = {
  key: string;
  name: string;
  seen: number;
  baseline: string;
};
export const FOLLOW_KEY = "grafobr-following-v1";
export function parseFollows(raw: string | null): Follow[] {
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (
    data.version !== 1 ||
    !Array.isArray(data.items) ||
    data.items.length > 500 ||
    data.items.some(
      (f: Follow) =>
        !f ||
        typeof f.key !== "string" ||
        !/^(state:(SP|MG|RJ|DF)|supplier:f[0-9a-f]{20})$/.test(f.key) ||
        typeof f.name !== "string" ||
        f.name.length > 500 ||
        !Number.isSafeInteger(f.seen) ||
        f.seen < 0 ||
        typeof f.baseline !== "string",
    ) ||
    new Set(data.items.map((f: Follow) => f.key)).size !== data.items.length
  )
    throw Error("Invalid follow preferences");
  return data.items;
}
export function unreadEvents(
  events: ContractEvent[],
  follows: Follow[],
  baseline: string,
) {
  return events.filter((e) =>
    follows.some(
      (f) =>
        f.baseline === baseline &&
        e.sequence > f.seen &&
        eventMatches(e, f.key),
    ),
  );
}
