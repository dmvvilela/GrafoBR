// Color maps for the graph. Node color encodes category; edge color encodes
// connectionType. Kept tiny and explicit so the legend is trivial to build.
import type { NodeCategory, ConnectionType } from "@/lib/contract";

const CATEGORY_COLORS: Record<NodeCategory, string> = {
  politician: "#2563eb", // blue
  company: "#16a34a", // green
  donor: "#d97706", // amber
  relative: "#9333ea", // purple
  other: "#6b7280", // gray
};

const EDGE_COLORS: Record<ConnectionType, string> = {
  socio: "#16a34a",
  doacao: "#d97706",
  contrato: "#2563eb",
  parente: "#9333ea",
  other: "#9ca3af",
};

export function getCategoryColor(category: NodeCategory): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
}

export function getEdgeColor(connectionType: ConnectionType): string {
  return EDGE_COLORS[connectionType] ?? EDGE_COLORS.other;
}

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  politician: "Político",
  company: "Empresa",
  donor: "Doador",
  relative: "Parente",
  other: "Outro",
};

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  socio: "Sócio",
  doacao: "Doação",
  contrato: "Contrato",
  parente: "Parente",
  other: "Outro",
};
