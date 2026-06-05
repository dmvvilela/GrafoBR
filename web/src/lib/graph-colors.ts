// Color maps for the graph, tuned to pop on the dark canvas. Node color encodes
// category; edge color encodes connectionType. Kept tiny so the legend is trivial.
import type { NodeCategory, ConnectionType } from "@/lib/contract";

const CATEGORY_COLORS: Record<NodeCategory, string> = {
  politician: "#818cf8", // indigo
  company: "#34d399", // emerald
  donor: "#fbbf24", // amber
  supplier: "#2dd4bf", // teal
  relative: "#f472b6", // pink
  other: "#94a3b8", // slate
};

const EDGE_COLORS: Record<ConnectionType, string> = {
  socio: "#34d399",
  doacao: "#fbbf24",
  despesa: "#2dd4bf",
  contrato: "#818cf8",
  parente: "#f472b6",
  other: "#64748b",
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
  supplier: "Fornecedor",
  relative: "Parente",
  other: "Outro",
};

export const CONNECTION_LABELS: Record<ConnectionType, string> = {
  socio: "Sócio",
  doacao: "Doação",
  despesa: "Despesa",
  contrato: "Contrato",
  parente: "Parente",
  other: "Outro",
};
