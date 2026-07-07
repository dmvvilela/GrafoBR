import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import ConnectionExplanation from "@/components/ConnectionExplanation";
import ExportButton from "@/components/ExportButton";
import PrintButton from "@/components/PrintButton";
import { getEgo, getIndex, getObrasInsight } from "@/lib/data";
import type { ObrasInsightLike } from "@/lib/profile-analysis";
import {
  anomalySignals,
  categoryTotals,
  linkTotals,
  profileCoverageWarnings,
  profileExportPayload,
} from "@/lib/profile-analysis";
import { CONNECTION_LABELS } from "@/lib/graph-colors";

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export async function generateStaticParams() {
  const index = await getIndex();
  return index.map((entry) => ({ id: String(entry.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ego = await getEgo(id);
  return {
    title: ego?.meta?.egoName
      ? `Dossiê ${ego.meta.egoName} — GrafoBR`
      : "Dossiê — GrafoBR",
    description:
      "Resumo exportável de conexões públicas, sinais de cobertura e evidências do GrafoBR.",
  };
}

export default async function DossiePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ego, index, obrasRaw] = await Promise.all([
    getEgo(id),
    getIndex(),
    getObrasInsight(id),
  ]);
  if (!ego) notFound();
  const entry = index.find((item) => String(item.id) === id) ?? null;
  const obrasInsight = obrasRaw as ObrasInsightLike | null;
  const warnings = profileCoverageWarnings(entry, ego);
  const anomalies = anomalySignals(ego, obrasInsight);
  const linkCounts = linkTotals(ego.links);
  const nodeCounts = categoryTotals(ego);
  const topLinks = ego.links
    .toSorted((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
    .slice(0, 10);
  const exportPayload = profileExportPayload(ego, entry, obrasInsight);

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/politico/${id}`} className="text-sm text-zinc-400 hover:text-zinc-200">
          ← voltar ao grafo
        </Link>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          <ExportButton
            filename={`${id}-dossie-grafobr.json`}
            payload={exportPayload}
            label="Exportar dossiê"
          />
        </div>
      </div>

      <header className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar id={Number(id)} name={ego.meta?.egoName ?? entry?.name ?? "?"} size={64} />
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-wide text-zinc-500 uppercase">
              Dossiê estático
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">
              {ego.meta?.egoName ?? entry?.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {entry?.party ?? "—"} {entry?.uf ? `· ${entry.uf}` : ""} · conexões, não acusações
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        {[
          ["Nós", ego.nodes.length],
          ["Vínculos", ego.links.length],
          ["Empresas", nodeCounts.get("company") ?? 0],
          ["Obras na UF", obrasInsight?.state.total ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-xs text-zinc-600">{label}</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-100 tabular-nums">
              {value}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-zinc-100">Cobertura</h2>
          <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-zinc-500">
            {warnings.length ? warnings.map((warning) => <li key={warning}>{warning}</li>) : <li>Sem ressalvas automáticas adicionais.</li>}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-zinc-100">Sinais para checagem</h2>
          <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-zinc-500">
            {anomalies.length ? anomalies.map((signal) => <li key={signal}>{signal}</li>) : <li>Nenhum sinal automático destacado neste recorte.</li>}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-zinc-100">Vínculos por tipo</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          {[...linkCounts.entries()].map(([type, count]) => (
            <div key={type} className="rounded-xl bg-white/[0.03] p-3">
              <div className="text-xs text-zinc-600">{CONNECTION_LABELS[type]}</div>
              <div className="mt-1 text-lg font-semibold text-zinc-200 tabular-nums">
                {count}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-zinc-100">Conexões explicadas</h2>
        <div className="mt-3 space-y-2">
          {topLinks.map((link) => (
            <ConnectionExplanation key={link.id} ego={ego} link={link} />
          ))}
        </div>
      </section>

      {obrasInsight && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-zinc-100">
            Obras públicas em {obrasInsight.uf}
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            {obrasInsight.state.paralisadas} paralisadas · {obrasInsight.state.atrasadas} com prazo vencido · {brl(obrasInsight.state.valorPrevisto)} em valor previsto confiável.
          </p>
          <ul className="mt-3 divide-y divide-white/5">
            {obrasInsight.possibleMatches.slice(0, 5).map((lead) => (
              <li key={`${lead.project.id}-${lead.area}`} className="py-2 text-sm">
                <Link href={`/obras/${lead.project.id}`} className="text-emerald-300 hover:underline">
                  {lead.project.nome || `CIPI ${lead.project.id}`}
                </Link>
                <p className="mt-1 text-xs text-zinc-600">
                  {lead.confidence === "media" ? "município + tema" : "UF + tema"} · {lead.area}
                  {typeof lead.score === "number" ? ` · score ${Math.round(lead.score)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
