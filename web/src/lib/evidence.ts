import type { ConnectionType } from "@/lib/contract";

export type EvidenceConfidence = "direta" | "forte" | "contextual" | "derivada";

export interface EvidenceLabel {
  confidence: EvidenceConfidence;
  label: string;
  detail: string;
  className: string;
}

const STYLES: Record<EvidenceConfidence, string> = {
  direta: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  forte: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
  contextual: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  derivada: "bg-zinc-400/10 text-zinc-300 ring-zinc-400/20",
};

export function evidenceForConnection(type: ConnectionType): EvidenceLabel {
  if (type === "socio") {
    return {
      confidence: "forte",
      label: "match forte",
      detail:
        "Ligação societária pareada por CPF mascarado e nome normalizado no snapshot CNPJ de maio de 2023.",
      className: STYLES.forte,
    };
  }
  if (type === "contrato") {
    return {
      confidence: "forte",
      label: "cadeia forte",
      detail:
        "Empresa ligada ao parlamentar aparece em contrato federal; a relação passa pela ligação societária.",
      className: STYLES.forte,
    };
  }
  if (type === "parente") {
    return {
      confidence: "derivada",
      label: "inferência",
      detail: "Ligação derivada; exige conferência manual antes de qualquer conclusão.",
      className: STYLES.derivada,
    };
  }
  if (type === "other") {
    return {
      confidence: "contextual",
      label: "contexto",
      detail: "Registro contextual, não usado como prova isolada de relação.",
      className: STYLES.contextual,
    };
  }
  return {
    confidence: "direta",
    label: "registro direto",
    detail: "Registro publicado diretamente pela fonte oficial indicada.",
    className: STYLES.direta,
  };
}

export function sourceForConnection(type: ConnectionType): string {
  const labels: Record<ConnectionType, string> = {
    doacao: "TSE — prestação de contas eleitorais",
    despesa: "Câmara dos Deputados — CEAP",
    socio: "Receita Federal — base CNPJ/QSA",
    contrato: "CGU / Base dos Dados — contratos federais",
    emenda: "CGU / Base dos Dados — emendas individuais",
    parente: "Dado derivado",
    other: "Fonte pública indicada no registro",
  };
  return labels[type];
}

export function sourceUrlForConnection(type: ConnectionType): string | null {
  const urls: Partial<Record<ConnectionType, string>> = {
    doacao: "https://dadosabertos.tse.jus.br/",
    despesa: "https://dadosabertos.camara.leg.br/",
    socio: "https://dadosabertos.rfb.gov.br/CNPJ/",
    contrato: "https://basedosdados.org/dataset/br-cgu-licitacao-contrato",
    emenda: "https://basedosdados.org/dataset/br-cgu-emendas-parlamentares",
  };
  return urls[type] ?? null;
}

export function politicianOfficialUrl(
  id: number | string | null | undefined,
  chamber?: "camara" | "senado" | null,
): string | null {
  if (!id || chamber !== "camara") return null;
  return `https://www.camara.leg.br/deputados/${id}`;
}

export function evidenceForObraLead(confidence: "baixa" | "media"): EvidenceLabel {
  if (confidence === "media") {
    return {
      confidence: "contextual",
      label: "pista média",
      detail:
        "Mesma UF, município indicado na emenda e tema compatível com texto/cadastro da obra.",
      className: STYLES.contextual,
    };
  }
  return {
    confidence: "contextual",
    label: "pista fraca",
    detail:
      "Mesma UF e tema compatível; não atribui autoria, responsabilidade ou financiamento.",
    className: STYLES.contextual,
  };
}

export function sourceBadges(sources: string[]): string[] {
  const badges: string[] = [];
  if (sources.includes("tse")) badges.push("doações");
  if (sources.includes("camara_ceap")) badges.push("CEAP");
  if (sources.includes("receita")) badges.push("empresas");
  if (sources.includes("transparencia")) badges.push("contratos");
  if (sources.includes("cgu_emendas")) badges.push("emendas");
  if (sources.includes("senado")) badges.push("Senado");
  return badges;
}
