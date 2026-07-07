import type { ConnectionType, EgoNetwork, GraphLink, GraphNode } from "@/lib/contract";
import {
  evidenceForConnection,
  sourceForConnection,
  sourceUrlForConnection,
} from "@/lib/evidence";

export type ProfileEntryLike = {
  id?: number;
  name?: string;
  party?: string | null;
  uf?: string | null;
  chamber?: "camara" | "senado";
  sources?: string[];
};

export const CONNECTION_TYPES: ConnectionType[] = [
  "doacao",
  "despesa",
  "socio",
  "contrato",
  "emenda",
];

export type ObrasLead = {
  kind: "same_uf_theme" | "same_uf_municipio_theme";
  confidence: "baixa" | "media";
  score?: number;
  area: string;
  municipio?: string | null;
  evidence?: string[];
  scoreReasons?: string[];
  project: {
    id: string;
    nome: string;
    signals: string[];
    municipio?: string | null;
  };
};

export type ObrasInsightLike = {
  uf: string;
  state: {
    total: number;
    paralisadas: number;
    atrasadas: number;
    baixoAvanco: number;
    valorPrevisto: number;
  };
  possibleMatches: ObrasLead[];
};

export function nodesById(ego: EgoNetwork): Map<number, GraphNode> {
  return new Map(ego.nodes.map((node) => [node.id, node]));
}

export function linkTotals(links: GraphLink[]): Map<ConnectionType, number> {
  const totals = new Map<ConnectionType, number>();
  for (const link of links) {
    totals.set(link.connectionType, (totals.get(link.connectionType) ?? 0) + 1);
  }
  return totals;
}

export function categoryTotals(ego: EgoNetwork): Map<GraphNode["category"], number> {
  const totals = new Map<GraphNode["category"], number>();
  for (const node of ego.nodes) {
    if (node.category === "politician") continue;
    totals.set(node.category, (totals.get(node.category) ?? 0) + 1);
  }
  return totals;
}

export function explainConnection(
  link: GraphLink,
  ego: EgoNetwork,
): {
  title: string;
  chain: string[];
  reading: string;
  source: string;
  sourceUrl: string | null;
} {
  const byId = nodesById(ego);
  const source = byId.get(link.source);
  const target = byId.get(link.target);
  const egoName = ego.meta?.egoName ?? source?.name ?? "Parlamentar";
  const other = source?.category === "politician" ? target : source;
  const otherName = other?.name ?? "registro público";
  const evidence = evidenceForConnection(link.connectionType);

  const chainByType: Record<ConnectionType, string[]> = {
    doacao: [egoName, "recebeu doação eleitoral registrada", otherName],
    despesa: [egoName, "pagou despesa CEAP registrada", otherName],
    socio: [egoName, "aparece ligado a empresa por cadastro societário", otherName],
    contrato: [
      egoName,
      "empresa ligada aparece em contrato federal",
      otherName,
    ],
    emenda: [egoName, "destinou emenda individual registrada", otherName],
    parente: [egoName, "tem ligação derivada que exige conferência", otherName],
    other: [egoName, "aparece em registro contextual", otherName],
  };

  return {
    title: `${egoName} → ${otherName}`,
    chain: chainByType[link.connectionType],
    reading: evidence.detail,
    source: sourceForConnection(link.connectionType),
    sourceUrl: sourceUrlForConnection(link.connectionType),
  };
}

export function profileCoverageWarnings(entry: ProfileEntryLike | null, ego: EgoNetwork): string[] {
  const warnings: string[] = [];
  const sources = new Set(entry?.sources ?? ego.meta?.sources ?? []);
  if (ego.meta?.chamber === "senado" || entry?.chamber === "senado") {
    warnings.push(
      "Senado: bases abertas não publicam CPF em formato suficiente para alguns cruzamentos de sócios e contratos.",
    );
  }
  if (!sources.has("receita")) {
    warnings.push("Sem cobertura de Receita/CNPJ neste perfil; ligações societárias podem não aparecer.");
  }
  if (!sources.has("camara_ceap")) {
    warnings.push("Sem CEAP da Câmara neste perfil; fornecedores de cota parlamentar podem estar ausentes.");
  }
  if (!sources.has("tse")) {
    warnings.push("Sem dados de doação TSE neste arquivo estático.");
  }
  if (!sources.has("cgu_emendas")) {
    warnings.push("Sem emendas individuais CGU carregadas para este perfil.");
  }
  if (ego.links.length === 0) {
    warnings.push("Grafo sem vínculos carregados; isso é ausência de dado no recorte, não prova de ausência de relações.");
  }
  return warnings;
}

export function anomalySignals(ego: EgoNetwork, obrasInsight?: ObrasInsightLike | null): string[] {
  const totals = linkTotals(ego.links);
  const nodes = ego.nodes;
  const signals: string[] = [];
  const suppliers = nodes.filter((node) => node.category === "supplier");
  const donors = nodes.filter((node) => node.category === "donor");
  const companies = nodes.filter((node) => node.category === "company");
  const supplierNames = new Set(suppliers.map((node) => node.name.toLocaleLowerCase("pt-BR")));
  const donorNames = new Set(donors.map((node) => node.name.toLocaleLowerCase("pt-BR")));
  const companyNames = new Set(companies.map((node) => node.name.toLocaleLowerCase("pt-BR")));

  const donorSupplierOverlap = [...donorNames].filter((name) =>
    supplierNames.has(name),
  );
  if (donorSupplierOverlap.length > 0) {
    signals.push(
      `${donorSupplierOverlap.length} nome aparece tanto como doador quanto como fornecedor CEAP.`,
    );
  }

  const companySupplierOverlap = [...companyNames].filter((name) =>
    supplierNames.has(name),
  );
  if (companySupplierOverlap.length > 0) {
    signals.push(
      `${companySupplierOverlap.length} empresa ligada também aparece como fornecedor no grafo.`,
    );
  }

  if ((totals.get("contrato") ?? 0) > 0 && (totals.get("socio") ?? 0) > 0) {
    signals.push("Há cadeia empresa ligada → contrato federal para checagem manual.");
  }

  const sharedSupplierHeavy = suppliers.filter((node) => node.connectionCount >= 20);
  if (sharedSupplierHeavy.length > 0) {
    signals.push(
      `${sharedSupplierHeavy.length} fornecedor CEAP é compartilhado por muitos parlamentares.`,
    );
  }

  const mediumObras = obrasInsight?.possibleMatches.filter(
    (match) =>
      match.confidence === "media" &&
      match.project.signals.some((signal) =>
        ["paralisada", "atrasada", "baixo_avanco"].includes(signal),
      ),
  );
  if ((mediumObras?.length ?? 0) > 0) {
    signals.push(
      `${mediumObras!.length} lead de obra combina município, tema e sinal operacional.`,
    );
  }

  return signals;
}

export function profileExportPayload(
  ego: EgoNetwork,
  entry: ProfileEntryLike | null,
  obrasInsight?: ObrasInsightLike | null,
) {
  return {
    generatedAt: new Date().toISOString(),
    profile: {
      id: entry?.id ?? ego.meta?.egoId ?? null,
      name: entry?.name ?? ego.meta?.egoName ?? null,
      party: entry?.party ?? null,
      uf: entry?.uf ?? null,
      chamber: entry?.chamber ?? ego.meta?.chamber ?? null,
      sources: entry?.sources ?? ego.meta?.sources ?? [],
    },
    counts: {
      nodes: ego.nodes.length,
      links: ego.links.length,
      byConnectionType: Object.fromEntries(linkTotals(ego.links)),
      byNodeCategory: Object.fromEntries(categoryTotals(ego)),
    },
    warnings: profileCoverageWarnings(entry, ego),
    anomalySignals: anomalySignals(ego, obrasInsight),
    links: ego.links.map((link) => ({
      ...link,
      explanation: explainConnection(link, ego),
    })),
    obras: obrasInsight
      ? {
          uf: obrasInsight.uf,
          state: obrasInsight.state,
          leads: obrasInsight.possibleMatches,
        }
      : null,
  };
}
