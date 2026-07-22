"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { AlertTriangle, ArrowLeft, ExternalLink, FileText, Link2, Search, SlidersHorizontal } from "lucide-react";
import NetworkGraph from "@/components/NetworkGraph";
import DeputyHighlights from "@/components/DeputyHighlights";
import ProfileFacts from "@/components/ProfileFacts";
import Avatar from "@/components/Avatar";
import ConnectionExplanation from "@/components/ConnectionExplanation";
import ExportButton from "@/components/ExportButton";
import type { ConnectionType, EgoNetwork, GraphLink, GraphNode } from "@/lib/contract";
import type { IndexEntry } from "@/lib/data";
import {
  CATEGORY_LABELS,
  CONNECTION_LABELS,
  getCategoryColor,
} from "@/lib/graph-colors";
import { isPartyDonor } from "@/lib/donors";
import {
  evidenceForConnection,
  evidenceForObraLead,
  politicianOfficialUrl,
  sourceForConnection,
  sourceUrlForConnection,
} from "@/lib/evidence";
import {
  anomalySignals,
  profileCoverageWarnings,
  profileExportPayload,
} from "@/lib/profile-analysis";

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

const CROSS_VERB: Record<string, (n: number) => string> = {
  donor: (n) =>
    `Também doou para ${n} ${n === 1 ? "outro deputado" : "outros deputados"}`,
  supplier: (n) =>
    `Também pago por ${n} ${n === 1 ? "outro deputado" : "outros deputados"}`,
  company: (n) =>
    `${n} ${n === 1 ? "outro deputado ligado" : "outros deputados ligados"}`,
};

const SOURCE_LABELS: Record<string, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
  camara_ceap: "Câmara dos Deputados — CEAP",
  cgu_emendas: "CGU — Emendas Parlamentares",
  tse: "TSE",
  receita: "Receita Federal",
  transparencia: "Portal da Transparência",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

type EntityDeputy = {
  id: number;
  name: string;
  party?: string | null;
  uf?: string | null;
  amount: number;
};
type EntityMap = Record<
  string,
  { id: string; name: string; category: string; count: number; deputies: EntityDeputy[] }
>;

type RelatedEntry = {
  id: number;
  name: string;
  party?: string | null;
  uf?: string | null;
  shared: number;
  entities: string[];
};

type ObrasProjectBrief = {
  id: string;
  nome: string;
  uf?: string | null;
  municipio?: string | null;
  codigoMunicipio?: string | number | null;
  situacao?: string | null;
  signals: string[];
  valorPrevisto?: number | null;
  dataFinalPrevista?: string | null;
  diasAtraso?: number;
  percentualFisico?: number | null;
  executor?: string | null;
  repassador?: string | null;
  orgao?: string | null;
  sourceIds?: {
    idUnico?: string | null;
    idProjetoInvestimento?: string | number | null;
  } | null;
};

function RawEvidence({
  link,
  other,
}: {
  link: GraphLink;
  other: string;
}) {
  const url = sourceUrlForConnection(link.connectionType);
  return (
    <details className="mt-2 rounded-lg bg-black/10 px-2 py-1.5">
      <summary className="cursor-pointer list-none text-[11px] text-zinc-500 transition hover:text-zinc-300">
        Ver registro usado
      </summary>
      <dl className="mt-1.5 grid gap-1 text-[11px] text-zinc-600">
        <div>
          <dt className="inline text-zinc-500">Tipo: </dt>
          <dd className="inline">{CONNECTION_LABELS[link.connectionType]}</dd>
        </div>
        <div>
          <dt className="inline text-zinc-500">Outro nó: </dt>
          <dd className="inline">{other}</dd>
        </div>
        <div>
          <dt className="inline text-zinc-500">Descrição: </dt>
          <dd className="inline">{link.description ?? "sem descrição no arquivo"}</dd>
        </div>
        <div>
          <dt className="inline text-zinc-500">ID interno: </dt>
          <dd className="inline font-mono">{link.id}</dd>
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex w-fit text-emerald-300 hover:underline"
          >
            Abrir fonte pública
          </a>
        ) : null}
      </dl>
    </details>
  );
}

type ObrasInsight = {
  uf: string;
  state: {
    total: number;
    paralisadas: number;
    atrasadas: number;
    baixoAvanco: number;
    valorPrevisto: number;
    top: ObrasProjectBrief[];
  };
  emendaAreas: { area: string; empenhado: number; pago: number }[];
  possibleMatches: {
    kind: "same_uf_theme" | "same_uf_municipio_theme";
    confidence: "baixa" | "media";
    score?: number;
    area: string;
    subfuncao?: string | null;
    acao?: string | null;
    municipio?: string | null;
    codigoMunicipio?: string | null;
    emendaEmpenhada: number;
    emendaPaga?: number;
    emendas?: number;
    sampleIds?: string[];
    evidence: string[];
    scoreReasons?: string[];
    project: ObrasProjectBrief;
  }[];
  note: string;
};

const urlOpts = { history: "replace" as const, shallow: true };

const FILTERS: {
  key: ConnectionType;
  label: string;
  tone: string;
}[] = [
  { key: "doacao", label: "Doações", tone: "bg-amber-400/10 text-amber-300 ring-amber-400/20" },
  { key: "despesa", label: "CEAP", tone: "bg-sky-400/10 text-sky-300 ring-sky-400/20" },
  { key: "socio", label: "Empresas", tone: "bg-violet-400/10 text-violet-300 ring-violet-400/20" },
  { key: "contrato", label: "Contratos", tone: "bg-rose-400/10 text-rose-300 ring-rose-400/20" },
  { key: "emenda", label: "Emendas", tone: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20" },
];

function filteredNetwork(ego: EgoNetwork, activeTypes: Set<ConnectionType>, strongOnly: boolean): EgoNetwork {
  const egoId = ego.meta?.egoId;
  const links = ego.links.filter((link) => {
    if (activeTypes.size > 0 && !activeTypes.has(link.connectionType)) return false;
    if (strongOnly) {
      const evidence = evidenceForConnection(link.connectionType).confidence;
      if (evidence !== "direta" && evidence !== "forte") return false;
    }
    return true;
  });
  const nodeIds = new Set<number>();
  if (egoId != null) nodeIds.add(egoId);
  for (const link of links) {
    nodeIds.add(link.source);
    nodeIds.add(link.target);
  }
  const degree = new Map<number, number>();
  for (const link of links) {
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
  }
  return {
    meta: ego.meta,
    links,
    nodes: ego.nodes
      .filter((node) => nodeIds.has(node.id))
      .map((node) => ({
        ...node,
        connectionCount: node.id === egoId ? links.length : (degree.get(node.id) ?? 0),
      })),
  };
}

function linkTotals(links: GraphLink[]): Map<ConnectionType, number> {
  const totals = new Map<ConnectionType, number>();
  for (const link of links) totals.set(link.connectionType, (totals.get(link.connectionType) ?? 0) + 1);
  return totals;
}

function standoutSummary({
  ego,
  partyDonors,
  privateDonors,
  related,
  obrasInsight,
}: {
  ego: EgoNetwork;
  partyDonors: number;
  privateDonors: number;
  related: RelatedEntry[];
  obrasInsight: ObrasInsight | null;
}) {
  const totals = linkTotals(ego.links);
  const pieces: string[] = [];
  const contracts = totals.get("contrato") ?? 0;
  const companies = totals.get("socio") ?? 0;
  const ceap = totals.get("despesa") ?? 0;
  const emendas = totals.get("emenda") ?? 0;
  if (contracts > 0 || companies > 0) {
    pieces.push(`${companies} ${companies === 1 ? "empresa ligada" : "empresas ligadas"} e ${contracts} ${contracts === 1 ? "contrato federal associado" : "contratos federais associados"}`);
  }
  if (privateDonors > 0) {
    pieces.push(`${privateDonors} ${privateDonors === 1 ? "doador privado" : "doadores privados"} registrados`);
  }
  if (ceap > 0) {
    pieces.push(`${ceap} ${ceap === 1 ? "fornecedor CEAP" : "fornecedores CEAP"} no grafo`);
  }
  if (emendas > 0) {
    pieces.push(`${emendas} ${emendas === 1 ? "destino de emenda" : "destinos de emenda"}`);
  }
  const mediumObras = obrasInsight?.possibleMatches.filter((match) => match.confidence === "media").length ?? 0;
  if (mediumObras > 0) {
    pieces.push(`${mediumObras} ${mediumObras === 1 ? "lead de obra com município+tema" : "leads de obras com município+tema"}`);
  } else if ((obrasInsight?.state.total ?? 0) > 0) {
    pieces.push(`${obrasInsight!.state.total} sinais de obras públicas na UF`);
  }
  if (related.length > 0) {
    pieces.push(`${related.length} ${related.length === 1 ? "parlamentar com conexão em comum" : "parlamentares com conexões em comum"}`);
  }
  if (pieces.length === 0 && partyDonors > 0) {
    pieces.push(`${partyDonors} ${partyDonors === 1 ? "doador partidário" : "doadores partidários"}`);
  }
  return pieces.slice(0, 3);
}

function SignalPill({ signal }: { signal: string }) {
  const label: Record<string, string> = {
    paralisada: "paralisada",
    atrasada: "prazo vencido",
    baixo_avanco: "baixo avanço",
    empenho_acima_previsto: "empenho alto",
  };
  return (
    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500 ring-1 ring-white/10">
      {label[signal] ?? signal}
    </span>
  );
}

function EgoViewInner({
  ego,
  entry,
}: {
  ego: EgoNetwork;
  entry: IndexEntry | null;
}) {
  const [query, setQuery] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions(urlOpts),
  );
  const [focusId, setFocusId] = useQueryState(
    "focus",
    parseAsInteger.withOptions(urlOpts),
  );

  const selected = useMemo(() => {
    if (focusId == null) return null;
    return ego.nodes.find((n) => n.id === focusId) ?? null;
  }, [focusId, ego.nodes]);

  const setSelected = useCallback(
    (node: GraphNode | null) => {
      void setFocusId(node?.id ?? null);
    },
    [setFocusId],
  );

  const [entities, setEntities] = useState<EntityMap>({});
  const [related, setRelated] = useState<RelatedEntry[]>([]);
  const [obrasInsight, setObrasInsight] = useState<ObrasInsight | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<ConnectionType>>(
    () => new Set(),
  );
  const [strongOnly, setStrongOnly] = useState(false);
  const sourceLabels = (ego.meta?.sources ?? []).map(sourceLabel);
  const depId = String(ego.meta?.egoId ?? entry?.id ?? "");
  const officialUrl = politicianOfficialUrl(
    ego.meta?.egoId ?? entry?.id,
    ego.meta?.chamber ?? entry?.chamber,
  );

  useEffect(() => {
    fetch("/data/_entities.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setEntities)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/data/_related.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((all: Record<string, RelatedEntry[]>) =>
        setRelated(all[depId] ?? []),
      )
      .catch(() => {});
  }, [depId]);

  useEffect(() => {
    if (!depId) return;
    fetch(`/data/obras-insights/${depId}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((insight: ObrasInsight | null) => setObrasInsight(insight))
      .catch(() => {});
  }, [depId]);

  const copyShareLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }, []);

  const nameById = useMemo(
    () => new Map(ego.nodes.map((n) => [n.id, n.name])),
    [ego.nodes],
  );

  const donors = ego.nodes.filter((n) => n.category === "donor");
  const partyDonors = donors.filter((n) => isPartyDonor(n.name)).length;
  const privateDonors = donors.length - partyDonors;
  const totals = useMemo(() => linkTotals(ego.links), [ego.links]);
  const graphData = useMemo(
    () => filteredNetwork(ego, activeTypes, strongOnly),
    [ego, activeTypes, strongOnly],
  );
  const standouts = useMemo(
    () =>
      standoutSummary({
        ego,
        partyDonors,
        privateDonors,
        related,
        obrasInsight,
      }),
    [ego, partyDonors, privateDonors, related, obrasInsight],
  );
  const warnings = useMemo(
    () => profileCoverageWarnings(entry, ego),
    [entry, ego],
  );
  const anomalies = useMemo(
    () => anomalySignals(ego, obrasInsight),
    [ego, obrasInsight],
  );
  const exportPayload = useMemo(
    () => profileExportPayload(ego, entry, obrasInsight),
    [ego, entry, obrasInsight],
  );

  const selectedLinks = useMemo(() => {
    if (!selected) return [];
    return ego.links
      .filter((l) => l.source === selected.id || l.target === selected.id)
      .map((l) => {
        const otherId = l.source === selected.id ? l.target : l.source;
        return {
          id: l.id,
          link: l,
          other: nameById.get(otherId) ?? "?",
          type: l.connectionType,
          description: l.description,
        };
      });
  }, [selected, ego.links, nameById]);

  const selectedEntity = useMemo(() => {
    if (!selected) return null;
    if (!selected.entityId) return null;
    const e = entities[selected.entityId];
    if (!e) return null;
    const others = e.deputies.filter((d) => d.id !== ego.meta?.egoId);
    if (others.length === 0) return null;
    return { category: e.category, total: e.count - 1, others };
  }, [selected, entities, ego.meta?.egoId]);

  const hasUrlState = query.trim().length > 0 || focusId != null;

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        <ArrowLeft size={15} /> todos os parlamentares
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-5">
        <Avatar
          id={ego.meta?.egoId ?? entry?.id ?? 0}
          name={ego.meta?.egoName ?? "?"}
          size={64}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {ego.meta?.egoName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            {entry?.party && (
              <span className="rounded-md bg-white/5 px-2 py-0.5 font-medium text-zinc-300 ring-1 ring-white/10">
                {entry.party}
              </span>
            )}
            {entry?.uf && <span className="text-zinc-400">{entry.uf}</span>}
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">
              {ego.meta?.chamber === "senado"
                ? "Senador(a)"
                : "Deputado(a) federal"}
            </span>
            {donors.length > 0 && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">
                  <span className="text-amber-300">{privateDonors}</span>{" "}
                  {privateDonors === 1 ? "doador privado" : "doadores privados"}{" "}
                  · {partyDonors} de partidos
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dossie/${depId}`}
            className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-400 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-zinc-200"
          >
            <FileText size={12} />
            Dossiê
          </Link>
          <Link
            href={`/investigar/${depId}`}
            className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-400 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-zinc-200"
          >
            Board
          </Link>
          <ExportButton
            filename={`${depId || "perfil"}-grafobr.json`}
            payload={exportPayload}
            label="JSON"
          />
          {(ego.meta?.sources ?? []).map((s) => (
            <span
              key={s}
              className="rounded-md bg-emerald-400/10 px-2 py-0.5 text-[11px] tracking-wide text-emerald-300 uppercase ring-1 ring-emerald-400/20"
            >
              {s}
            </span>
          ))}
          {officialUrl && (
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-400 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-zinc-200"
            >
              Câmara <ExternalLink size={11} />
            </a>
          )}
          {hasUrlState && (
            <button
              type="button"
              onClick={copyShareLink}
              className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-400 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-zinc-200"
              title="Copiar link desta visualização"
            >
              <Link2 size={12} />
              {copied ? "Copiado!" : "Compartilhar"}
            </button>
          )}
        </div>
      </header>

      {ego.meta?.summary ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-sm leading-relaxed text-zinc-300">
            {ego.meta.summary}
          </p>
          <p className="mt-2 text-[11px] text-zinc-600">
            Resumo gerado por IA local a partir dos registros públicos abaixo —
            conexões, não acusações.
          </p>
        </div>
      ) : null}

      {(warnings.length > 0 || anomalies.length > 0) && (
        <section className="grid gap-3 lg:grid-cols-2">
          {warnings.length > 0 ? (
            <div className="rounded-2xl border border-amber-400/10 bg-amber-400/[0.03] p-4">
              <h2 className="flex items-center gap-2 text-sm font-medium text-amber-200">
                <AlertTriangle size={15} />
                Cobertura e cautelas
              </h2>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-zinc-500">
                {warnings.slice(0, 4).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {anomalies.length > 0 ? (
            <div className="rounded-2xl border border-rose-400/10 bg-rose-400/[0.025] p-4">
              <h2 className="text-sm font-medium text-rose-200">
                Sinais para priorizar checagem
              </h2>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-zinc-500">
                {anomalies.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      {standouts.length > 0 ? (
        <section className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.03] p-4">
          <h2 className="text-sm font-medium text-emerald-200">
            Por que este perfil se destaca
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Resumo mecânico dos registros carregados nesta página. Serve para
            priorizar checagem, não para concluir irregularidade.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {standouts.map((item) => (
              <li
                key={item}
                className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-zinc-300 ring-1 ring-white/5"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ProfileFacts
        ego={ego}
        relatedCount={related.length}
        obrasSignals={obrasInsight?.state.total}
      />

      <DeputyHighlights ego={ego} />

      {obrasInsight && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-zinc-200">
                Obras públicas em {obrasInsight.uf}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Contexto estadual do Obrasgov.br cruzado com temas de emendas —
                pistas documentais, não atribuição de responsabilidade.
              </p>
            </div>
            <Link
              href="/obras"
              className="text-xs text-emerald-300 hover:underline"
            >
              ver ranking
            </Link>
          </div>

          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-white/[0.03] p-3">
              <span className="block text-zinc-600">Sinais no estado</span>
              <span className="mt-1 block text-lg font-semibold text-zinc-200 tabular-nums">
                {obrasInsight.state.total.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="rounded-xl bg-rose-500/10 p-3">
              <span className="block text-rose-300/70">Paralisadas</span>
              <span className="mt-1 block text-lg font-semibold text-rose-200 tabular-nums">
                {obrasInsight.state.paralisadas.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="rounded-xl bg-orange-500/10 p-3">
              <span className="block text-orange-300/70">Prazo vencido</span>
              <span className="mt-1 block text-lg font-semibold text-orange-200 tabular-nums">
                {obrasInsight.state.atrasadas.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="rounded-xl bg-white/[0.03] p-3">
              <span className="block text-zinc-600">Valor previsto</span>
              <span className="mt-1 block text-sm font-semibold text-zinc-200 tabular-nums">
                {brl(obrasInsight.state.valorPrevisto)}
              </span>
            </div>
          </div>

          {obrasInsight.possibleMatches.length > 0 ? (
            <div className="mt-4 border-t border-white/5 pt-3">
              <h3 className="text-xs font-medium text-zinc-300">
                Leads temáticos para checar
              </h3>
              <ul className="mt-2 divide-y divide-white/5">
                {obrasInsight.possibleMatches.slice(0, 3).map((match) => (
                  <li key={match.project.id} className="py-2.5 first:pt-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-sm leading-snug text-zinc-300">
                        {match.project.nome || `CIPI ${match.project.id}`}
                      </p>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ring-1 ${evidenceForObraLead(match.confidence).className}`}>
                        {evidenceForObraLead(match.confidence).label}
                      </span>
                      {typeof match.score === "number" ? (
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500 ring-1 ring-white/10">
                          score {Math.round(match.score)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      Tema: <span className="text-zinc-500">{match.area}</span>
                      {match.municipio ? (
                        <>
                          {" "}
                          · Município:{" "}
                          <span className="text-zinc-500">{match.municipio}</span>
                        </>
                      ) : null}
                      {match.project.executor
                        ? ` · Executor: ${match.project.executor}`
                        : ""}
                    </p>
                    {match.acao ? (
                      <p className="mt-1 text-xs text-zinc-600">
                        Ação da emenda:{" "}
                        <span className="text-zinc-500">{match.acao}</span>
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {match.project.signals.map((signal) => (
                        <SignalPill key={signal} signal={signal} />
                      ))}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ring-1 ${
                          match.confidence === "media"
                            ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                            : "bg-white/5 text-zinc-500 ring-white/10"
                        }`}
                      >
                        {match.confidence === "media"
                          ? "mesmo município + tema"
                          : "mesma UF + tema"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
                      {evidenceForObraLead(match.confidence).detail}
                    </p>
                    {(match.scoreReasons?.length ?? 0) > 0 ? (
                      <details className="mt-1.5">
                        <summary className="cursor-pointer list-none text-[11px] text-zinc-500 transition hover:text-zinc-300">
                          Ver critérios do lead
                        </summary>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-zinc-600 marker:text-zinc-700">
                          {match.scoreReasons!.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 border-t border-white/5 pt-3 text-xs text-zinc-600">
              Sem correspondência temática automática com as áreas de emendas
              deste parlamentar.
            </p>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-zinc-200">
            Parlamentares com conexões em comum
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Compartilham doadores, empresas ou fornecedores nos registros
            públicos — conexões, não acusações.
          </p>
          <ul className="mt-3 divide-y divide-white/5">
            {related.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/politico/${r.id}`}
                    className="text-sm text-emerald-300 hover:underline"
                  >
                    {r.name}
                    {r.party ? (
                      <span className="text-zinc-500"> · {r.party}</span>
                    ) : null}
                    {r.uf ? (
                      <span className="text-zinc-600"> · {r.uf}</span>
                    ) : null}
                  </Link>
                  {r.entities.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-zinc-600">
                      ex.: {r.entities.join(", ")}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                  {r.shared} {r.shared === 1 ? "conexão" : "conexões"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        {ego.links.length === 0 ? (
          <div className="grid h-[560px] place-items-center rounded-2xl border border-white/5 bg-white/[0.03] p-8 text-center">
            <div className="max-w-sm space-y-2">
              <p className="text-sm font-medium text-zinc-300">
                Sem conexões atribuídas nesta base.
              </p>
              <p className="text-xs leading-relaxed text-zinc-500">
                Não identificamos emendas individuais (2023+) para este
                parlamentar nos dados da CGU. A base aberta do Senado não
                publica CPF, então não cruzamos sócios e contratos para
                senadores.
              </p>
            </div>
          </div>
        ) : graphData.links.length === 0 ? (
          <div className="grid h-[560px] place-items-center rounded-2xl border border-white/5 bg-white/[0.03] p-8 text-center">
            <div className="max-w-sm space-y-2">
              <p className="text-sm font-medium text-zinc-300">
                Nenhuma conexão passa pelos filtros atuais.
              </p>
              <p className="text-xs leading-relaxed text-zinc-500">
                Remova um tipo de vínculo ou desligue “só fortes” para voltar a
                ver o grafo completo.
              </p>
            </div>
          </div>
        ) : (
          <NetworkGraph
            data={graphData}
            searchQuery={query}
            focusId={selected?.id ?? null}
            onSelectNode={setSelected}
          />
        )}

        <aside className="space-y-4">
          <div className="relative">
            <Search
              size={15}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={query}
              onChange={(e) => void setQuery(e.target.value || null)}
              placeholder="Filtrar no grafo"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pr-3 pl-9 text-sm text-zinc-100 transition outline-none placeholder:text-zinc-500 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
            />
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center gap-2 border-b border-white/5 pb-3">
              <SlidersHorizontal size={14} className="text-zinc-500" />
              <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                Filtros do grafo
              </h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((filter) => {
                const total = totals.get(filter.key) ?? 0;
                const active = activeTypes.has(filter.key);
                return (
                  <button
                    key={filter.key}
                    type="button"
                    disabled={total === 0}
                    onClick={() =>
                      setActiveTypes((current) => {
                        const next = new Set(current);
                        if (next.has(filter.key)) next.delete(filter.key);
                        else next.add(filter.key);
                        return next;
                      })
                    }
                    className={`rounded-lg px-2 py-1 text-[11px] ring-1 transition ${
                      active
                        ? filter.tone
                        : "bg-white/[0.03] text-zinc-500 ring-white/10 hover:bg-white/[0.06] hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-35"
                    }`}
                  >
                    {filter.label} · {total}
                  </button>
                );
              })}
            </div>
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/[0.02] px-3 py-2 text-xs text-zinc-400 ring-1 ring-white/5">
              <span>Só registros diretos/fortes</span>
              <input
                type="checkbox"
                checked={strongOnly}
                onChange={(event) => setStrongOnly(event.target.checked)}
                className="h-4 w-4 accent-emerald-400"
              />
            </label>
            <p className="mt-2 text-[11px] text-zinc-600">
              Mostrando {graphData.links.length} de {ego.links.length} vínculos.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/5 pb-3">
              <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                Inspeção
              </h2>
              <span className="text-[11px] text-zinc-600">
                {selectedLinks.length
                  ? `${selectedLinks.length} vínculo${selectedLinks.length === 1 ? "" : "s"}`
                  : "sem seleção"}
              </span>
            </div>
            {selected ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: getCategoryColor(selected.category),
                    }}
                  />
                  <span className="text-sm font-medium text-zinc-100">
                    {selected.name}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {CATEGORY_LABELS[selected.category]} ·{" "}
                  {selected.connectionCount} conexões
                </p>

                {selected.category === "donor" && (
                  <span
                    className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[11px] ring-1 ${
                      isPartyDonor(selected.name)
                        ? "bg-white/5 text-zinc-400 ring-white/10"
                        : "bg-amber-400/10 text-amber-300 ring-amber-400/20"
                    }`}
                  >
                    {isPartyDonor(selected.name)
                      ? "Comitê de partido"
                      : "Doador privado"}
                  </span>
                )}

                <ul className="mt-3 space-y-2">
                  {selectedLinks.map((l) => (
                    <li
                      key={l.id}
                      className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-xs leading-relaxed text-zinc-400"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-zinc-300">
                          {CONNECTION_LABELS[l.type]}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ring-1 ${evidenceForConnection(l.type).className}`}>
                          {evidenceForConnection(l.type).label}
                        </span>
                      </div>
                      {l.description ? <> · {l.description}</> : null}
                      <details className="mt-1.5 group">
                        <summary className="cursor-pointer list-none text-[11px] text-zinc-500 transition hover:text-zinc-300">
                          Ver evidência
                        </summary>
                        <dl className="mt-1.5 space-y-1 border-t border-white/5 pt-1.5 text-[11px] text-zinc-600">
                          <div>
                            <dt className="inline text-zinc-500">Fonte: </dt>
                            <dd className="inline">
                              {sourceUrlForConnection(l.type) ? (
                                <a
                                  href={sourceUrlForConnection(l.type) ?? undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-300 hover:underline"
                                >
                                  {sourceForConnection(l.type)}
                                </a>
                              ) : (
                                sourceForConnection(l.type)
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline text-zinc-500">Leitura: </dt>
                            <dd className="inline">
                              {evidenceForConnection(l.type).detail}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline text-zinc-500">Outro nó: </dt>
                            <dd className="inline">{l.other}</dd>
                          </div>
                        </dl>
                        <div className="mt-2 border-t border-white/5 pt-2">
                          <ConnectionExplanation
                            ego={ego}
                            link={l.link}
                            compact
                          />
                        </div>
                        <RawEvidence link={l.link} other={l.other} />
                      </details>
                    </li>
                  ))}
                </ul>

                {selectedEntity && (
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <p className="text-xs font-medium text-zinc-400">
                      {(
                        CROSS_VERB[selectedEntity.category] ??
                        CROSS_VERB.company
                      )(selectedEntity.total)}
                    </p>
                    <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto pr-1">
                      {selectedEntity.others.slice(0, 12).map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <Link
                            href={`/politico/${d.id}`}
                            className="truncate text-xs text-emerald-300 hover:underline"
                          >
                            {d.name}
                            {d.party ? (
                              <span className="text-zinc-600">
                                {" "}
                                · {d.party}
                              </span>
                            ) : null}
                          </Link>
                          {d.amount > 0 && (
                            <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
                              {brl(d.amount)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {selectedEntity.total > 12 && (
                      <p className="mt-1.5 text-xs text-zinc-600">
                        + {selectedEntity.total - 12} outros
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-300">
                  Nenhum nó selecionado
                </p>
                <p className="text-xs leading-relaxed text-zinc-500">
                  Clique em um nó para ver vínculos, fonte, leitura recomendada e
                  evidência disponível.
                </p>
              </div>
            )}
          </div>

          <p className="px-1 text-xs leading-relaxed text-zinc-600">
            Conexões a partir de dados públicos
            {sourceLabels.length ? ` (${sourceLabels.join(", ")})` : ""}. Não
            representam acusação de irregularidade.
          </p>
          {Object.keys(ego.meta.sourceCoverage).length > 0 && (
            <p className="px-1 text-[11px] leading-relaxed text-zinc-600">
              Recortes: {Object.entries(ego.meta.sourceCoverage)
                .map(([source, coverage]) => `${sourceLabel(source)} — ${coverage}`)
                .join("; ")}.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function EgoView({
  ego,
  entry,
}: {
  ego: EgoNetwork;
  entry: IndexEntry | null;
}) {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-40 rounded bg-white/5" />
          <div className="h-24 rounded-2xl bg-white/5" />
          <div className="h-[560px] rounded-2xl bg-white/5" />
        </div>
      }
    >
      <EgoViewInner ego={ego} entry={entry} />
    </Suspense>
  );
}
