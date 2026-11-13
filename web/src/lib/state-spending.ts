export type SpendingUnit = "perCapita" | "share" | "total";
export type SpendingMetric = "10" | "12" | "06" | "investment" | "total";
export interface SpendingRecord {
  year: number; population: number; fetchedAt: string; sourceUrls: string[];
  status: "available" | "missing"; total: number | null;
  functions: Record<string, number>; investment: number | null;
}
export interface SpendingState { code: number; uf: string; name: string; records: SpendingRecord[] }
export interface SpendingSnapshot {
  schemaVersion: 1; version: string; fetchedAt: string; years: number[];
  basis: "liquidated-excluding-intra";
  populationSource: { url: string; table: string; fetchedAt: string };
  states: SpendingState[];
}
export interface SpendingSelection { a: string; b: string; year: number; metric: SpendingMetric; unit: SpendingUnit }
export const METRICS: Record<SpendingMetric, string> = { "10": "Saúde", "12": "Educação", "06": "Segurança pública", investment: "Investimentos", total: "Despesa total" };
export const UNITS: Record<SpendingUnit, string> = { perCapita: "R$ por habitante", share: "% da despesa", total: "Valor total" };
export const FUNCTION_NAMES: Record<string, string> = {
  "01":"Legislativa", "02":"Judiciária", "03":"Essencial à Justiça", "04":"Administração", "05":"Defesa Nacional", "06":"Segurança pública", "07":"Relações Exteriores", "08":"Assistência social", "09":"Previdência social", "10":"Saúde", "11":"Trabalho", "12":"Educação", "13":"Cultura", "14":"Direitos da Cidadania", "15":"Urbanismo", "16":"Habitação", "17":"Saneamento", "18":"Gestão Ambiental", "19":"Ciência e Tecnologia", "20":"Agricultura", "21":"Organização Agrária", "22":"Indústria", "23":"Comércio e Serviços", "24":"Comunicações", "25":"Energia", "26":"Transporte", "27":"Desporto e Lazer", "28":"Encargos Especiais", "99":"Reserva de Contingência",
};
export function spendingAmount(record: SpendingRecord | undefined, metric: SpendingMetric): number | null {
  if (!record || record.status !== "available") return null;
  return metric === "total" ? record.total : metric === "investment" ? record.investment : record.functions[metric] ?? null;
}
export function spendingValue(record: SpendingRecord | undefined, metric: SpendingMetric, unit: SpendingUnit): number | null {
  const amount = spendingAmount(record, metric);
  if (amount == null || !record) return null;
  if (unit === "perCapita") return record.population > 0 ? amount / record.population : null;
  if (unit === "share") return record.total != null && record.total > 0 ? amount / record.total * 100 : null;
  return amount;
}
export function formatSpending(value: number | null, unit: SpendingUnit, compact = false): string {
  if (value == null) return "Sem dados";
  if (unit === "share") return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: compact ? 1 : 2, ...(compact ? { notation: "compact" as const } : {}) }).format(value);
}
export function composition(record: SpendingRecord | undefined): number[] | null {
  if (!record || record.total == null || record.total <= 0) return null;
  const values = ["10", "12", "06"].map(k => record.functions[k]);
  if (values.some(v => v == null)) return null;
  const rest = record.total - values.reduce((a,b) => a+b,0);
  if (rest < -1) return null;
  return [...values, Math.max(0,rest)].map(v => v / record.total! * 100);
}
export function readSpendingSelection(params: URLSearchParams, data: SpendingSnapshot): { selection: SpendingSelection; corrected: boolean; stale: boolean } {
  const validUf = (s: string | null) => data.states.some(e => e.uf === s);
  const a = validUf(params.get("a")) ? params.get("a")! : "SP";
  const b = validUf(params.get("b")) ? params.get("b")! : (a === "MG" ? "SP" : "MG");
  const year = data.years.includes(Number(params.get("year"))) ? Number(params.get("year")) : Math.max(...data.years);
  const metric = Object.hasOwn(METRICS, params.get("metric") ?? "") ? params.get("metric") as SpendingMetric : "10";
  const unit = Object.hasOwn(UNITS, params.get("unit") ?? "") ? params.get("unit") as SpendingUnit : "perCapita";
  const selection = { a, b, year, metric, unit };
  return { selection, corrected: Object.entries(selection).some(([k,v]) => params.has(k) && params.get(k) !== String(v)), stale: params.has("v") && params.get("v") !== data.version };
}
export function spendingPath(s: SpendingSelection, version: string): string {
  return `/estados?${new URLSearchParams({a:s.a,b:s.b,year:String(s.year),metric:s.metric,unit:s.unit,v:version})}`;
}
