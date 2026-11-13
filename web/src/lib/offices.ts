export type OfficeKind = "camara" | "senado" | "presidencia" | "governo";

export interface OfficeRecord {
  verifiedAt: string;
  sourceUrl: string;
  note: string;
  campaignYear: number | null;
  campaignOffice: string | null;
  campaignParty: string | null;
}

export const OFFICE_LABELS: Record<OfficeKind, string> = {
  camara: "Deputado(a) federal",
  senado: "Senador(a)",
  presidencia: "Presidente da República",
  governo: "Governador(a)",
};
export function officeLabel(kind?: OfficeKind | null): string {
  return OFFICE_LABELS[kind ?? "camara"];
}
export function isExecutive(kind?: OfficeKind | null): boolean {
  return kind === "presidencia" || kind === "governo";
}
