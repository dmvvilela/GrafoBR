import type { ConnectionType } from "./contract";
export interface SupplierConnection {
  profileId: number;
  profileName: string;
  nodeId: number;
  entityId: string;
  snapshot: string;
  direct: boolean;
  relationships: ConnectionType[];
}
export interface StateSupplier {
  id: string;
  name: string;
  aliases: string[];
  connections: SupplierConnection[];
}
export interface StateContract {
  id: string;
  supplierId: string;
  supplierName: string;
  uf: "SP" | "MG";
  agency: string;
  unit: string;
  power: "E" | "L" | "J";
  number: string;
  year: number;
  object: string;
  initialValue: number;
  signedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  publishedAt: string;
  updatedAt: string;
  sourceUrl: string;
}
export interface StateContractsSnapshot {
  schemaVersion: 1;
  version: string;
  fetchedAt: string;
  period: { start: string; end: string; basis: "publication" };
  graphFingerprint: string;
  source: string;
  coverage: {
    states: string[];
    nationalRecordsChecked: number;
    stateRecordsChecked: number;
    excluded: Record<string, number>;
    days: {
      date: string;
      nationalRecords: number;
      pages: number;
      stateRecords: number;
    }[];
  };
  suppliers: StateSupplier[];
  contracts: StateContract[];
}
export const contractMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const contractDate = (v: string | null) => {
  if (!v) return "Não informado";
  const instant = /(?:Z|[+-]\d{2}:\d{2})$/.test(v);
  return new Date(
    instant ? v : `${v.slice(0, 10)}T12:00:00Z`,
  ).toLocaleDateString("pt-BR", {
    timeZone: instant ? "America/Sao_Paulo" : "UTC",
  });
};
export const contractPeriod = (p: StateContractsSnapshot["period"]) =>
  `${contractDate(p.start)} a ${contractDate(p.end)}`;
export const RELATION_NAMES: Record<string, string> = {
  socio: "quadro societário histórico",
  doacao: "doação eleitoral histórica",
  despesa: "despesa parlamentar",
  contrato: "contrato público",
  emenda: "emenda parlamentar",
  other: "conexão documental",
  parente: "parentesco",
};

export const contractProfilePath = (connection: SupplierConnection) =>
  `/politico/${connection.profileId}?focus=${connection.nodeId}&cv=${encodeURIComponent(connection.snapshot)}`;
export const isContractFocusCurrent = (
  requested: string | null,
  current: string,
) => !requested || requested === current;

export type ContractsDirectoryData = {
  period: StateContractsSnapshot["period"];
  suppliers: { id: string; name: string; connectionCount: number }[];
  contracts: Pick<
    StateContract,
    | "id"
    | "supplierId"
    | "supplierName"
    | "uf"
    | "agency"
    | "number"
    | "year"
    | "object"
    | "initialValue"
    | "publishedAt"
  >[];
};
export function contractDirectoryData(
  data: StateContractsSnapshot,
): ContractsDirectoryData {
  return {
    period: data.period,
    suppliers: data.suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      connectionCount: s.connections.length,
    })),
    contracts: data.contracts.map((c) => ({
      id: c.id,
      supplierId: c.supplierId,
      supplierName: c.supplierName,
      uf: c.uf,
      agency: c.agency,
      number: c.number,
      year: c.year,
      object: c.object,
      initialValue: c.initialValue,
      publishedAt: c.publishedAt,
    })),
  };
}
