import type { Metadata } from "next";
import Link from "next/link";
import ObrasExplorer from "@/components/ObrasExplorer";
import { getObras } from "@/lib/data";
import type { ObraProject } from "@/lib/data";

export const metadata: Metadata = {
  title: "Obras públicas — GrafoBR",
  description:
    "Projetos federais de infraestrutura com sinais de paralisia ou atraso nos registros do Obrasgov.br.",
};

function brl(value: number | null | undefined): string {
  if (!isReliableMoney(value)) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function isReliableMoney(value: number | null | undefined): value is number {
  return typeof value === "number" && value > 1;
}

function pct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("pt-BR")}%`;
}

function isReliableDate(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const year = Number(iso.slice(0, 4));
  return Number.isFinite(year) && year >= 1990;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso || !isReliableDate(iso)) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

/** Human-readable delay — avoids pt-BR thousands sep (2.356 reads as 2,3 days). */
function formatAtraso(days: number): string {
  if (days < 1) return "";
  if (days === 1) return "1 dia de atraso";
  if (days < 60) return `${days} dias de atraso`;

  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30);

  if (years === 0) {
    if (months <= 1) return "1 mês de atraso";
    return `${months} meses de atraso`;
  }

  const yPart = years === 1 ? "1 ano" : `${years} anos`;
  if (months <= 0) return `${yPart} de atraso`;
  const mPart = months === 1 ? "1 mês" : `${months} meses`;
  return `${yPart} e ${mPart} de atraso`;
}

function SignalBadge({ signal }: { signal: string }) {
  const styles: Record<string, string> = {
    paralisada: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
    atrasada: "bg-orange-500/15 text-orange-300 ring-orange-500/25",
    baixo_avanco: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
    empenho_acima_previsto: "bg-yellow-500/15 text-yellow-200 ring-yellow-500/25",
  };
  const labels: Record<string, string> = {
    paralisada: "Paralisada",
    atrasada: "Prazo vencido",
    baixo_avanco: "Baixo avanço físico",
    empenho_acima_previsto: "Empenho acima do previsto",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${styles[signal] ?? "bg-zinc-500/15 text-zinc-400 ring-zinc-500/25"}`}
    >
      {labels[signal] ?? signal}
    </span>
  );
}

function projectValue(project: ObraProject): number {
  return isReliableMoney(project.valorPrevisto) ? project.valorPrevisto : 0;
}

function projectDelay(project: ObraProject): number {
  return isReliableDate(project.dataFinalPrevista)
    ? (project.diasAtraso ?? 0)
    : 0;
}

function ObraRow({ project, rank }: { project: ObraProject; rank: number }) {
  const sourceId = project.sourceIds?.idUnico ?? project.id;
  const href = `/obras/${encodeURIComponent(project.id)}`;
  const unreliableValue =
    !isReliableMoney(project.valorPrevisto) &&
    isReliableMoney(project.valorPrevistoOriginal);
  const unreliableDate =
    !isReliableDate(project.dataFinalPrevista) &&
    Boolean(project.dataFinalPrevistaOriginal ?? project.dataFinalPrevista);

  return (
    <li className="px-3 py-3">
      <div className="flex gap-3">
        <span className="w-7 shrink-0 pt-0.5 text-right text-xs font-medium text-zinc-600 tabular-nums">
          {rank}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-sm font-medium leading-snug text-zinc-100">
              <Link href={href} className="transition hover:text-emerald-300">
                {project.nome || project.id}
              </Link>
            </h3>
            <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
              {project.uf ?? "—"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {project.signals.map((s) => (
              <SignalBadge key={s} signal={s} />
            ))}
          </div>
          <dl className="grid gap-x-4 gap-y-1 text-xs text-zinc-500 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-zinc-600">Previsto</dt>
              <dd className="font-medium text-zinc-300 tabular-nums">
                {brl(project.valorPrevisto)}
                {unreliableValue && (
                  <span className="ml-1 text-[10px] text-zinc-600">
                    valor bruto ignorado
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Empenhado</dt>
              <dd className="font-medium text-zinc-300 tabular-nums">
                {brl(project.valorEmpenhado)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Avanço físico</dt>
              <dd className="font-medium text-zinc-300 tabular-nums">
                {pct(project.percentualFisico)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-600">Prazo previsto</dt>
              <dd className="font-medium text-zinc-300">
                {formatDate(project.dataFinalPrevista)}
                {unreliableDate && (
                  <span className="ml-1 text-[10px] text-zinc-600">
                    data inválida ignorada
                  </span>
                )}
                {projectDelay(project) > 0 && (
                  <span className="ml-1 block text-orange-400 sm:inline">
                    {formatAtraso(projectDelay(project))}
                  </span>
                )}
              </dd>
            </div>
          </dl>
          {(project.motivosParalisacao?.length ?? 0) > 0 && (
            <p className="text-xs text-zinc-600">
              Motivos registrados:{" "}
              <span className="text-zinc-500">
                {project.motivosParalisacao!.join(" · ")}
              </span>
            </p>
          )}
          {(project.executor || project.repassador) && (
            <p className="text-xs text-zinc-600">
              {project.repassador && (
                <>
                  Repasse:{" "}
                  <span className="text-zinc-500">{project.repassador}</span>
                </>
              )}
              {project.executor && (
                <>
                  {project.repassador ? " · " : ""}
                  Executor:{" "}
                  <span className="text-zinc-500">{project.executor}</span>
                </>
              )}
            </p>
          )}
          <p className="font-mono text-[10px] text-zinc-700">
            CIPI {sourceId}
          </p>
        </div>
      </div>
    </li>
  );
}

function ObraList({
  title,
  subtitle,
  accent,
  projects,
}: {
  title: string;
  subtitle: string;
  accent: string;
  projects: ObraProject[];
}) {
  if (!projects.length) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`text-lg font-semibold ${accent}`}>{title}</h2>
        <span className="text-xs text-zinc-500">{subtitle}</span>
      </div>
      <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
        {projects.map((p, i) => (
          <ObraRow key={p.id} project={p} rank={i + 1} />
        ))}
      </ol>
    </section>
  );
}

export default async function ObrasPage() {
  const data = await getObras();

  if (!data) {
    return (
      <div className="space-y-4 pt-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Obras públicas</h1>
        <p className="text-sm text-zinc-500">
          Dados ainda não gerados. Execute{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">
            pipeline/scripts/fetch_obras.py
          </code>{" "}
          e sincronize o site.
        </p>
      </div>
    );
  }

  const allProjects = data.all ?? [...data.paralisadas, ...data.atrasadas];
  const topParalisadas = [...data.paralisadas]
    .sort((a, b) => projectValue(b) - projectValue(a))
    .slice(0, 50);
  const topAtrasadas = [...data.atrasadas]
    .sort((a, b) => projectDelay(b) - projectDelay(a))
    .slice(0, 50);
  const unreliableValues = allProjects.filter(
    (p) => !isReliableMoney(p.valorPrevisto),
  ).length;
  const unreliableDates = allProjects.filter(
    (p) =>
      p.signals.includes("atrasada") && !isReliableDate(p.dataFinalPrevista),
  ).length;
  const generated = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(data.meta.generatedAt));

  return (
    <div className="space-y-10">
      <header className="pt-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Obras públicas</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-400">
          Projetos federais de infraestrutura com sinais de paralisia, atraso ou
          baixo avanço físico nos registros do{" "}
          <a
            href={data.meta.sourceUrl}
            className="text-zinc-300 underline decoration-white/20 underline-offset-2 hover:text-zinc-100"
            target="_blank"
            rel="noopener noreferrer"
          >
            Obrasgov.br
          </a>
          .{" "}
          <span className="text-zinc-500">
            Registros oficiais de acompanhamento — não são acusações.
          </span>
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          {data.meta.counts.paralisada.toLocaleString("pt-BR")} paralisadas ·{" "}
          {data.meta.counts.atrasada.toLocaleString("pt-BR")} com prazo vencido ·{" "}
          {data.meta.counts.flagged.toLocaleString("pt-BR")} com sinal de atenção
          {data.meta.counts.discovered
            ? ` (${data.meta.counts.discovered.toLocaleString("pt-BR")} projetos amostrados)`
            : ""}
        </p>
        <p className="mt-1 text-xs text-zinc-700">
          Snapshot gerado em {generated}. Valores de R$0/R$0,01 e datas sentinela
          antigas são tratados como sem dado confiável.
        </p>
        {data.meta.discoveryNote && (
          <p className="mx-auto mt-3 max-w-2xl text-[11px] leading-relaxed text-zinc-600">
            {data.meta.discoveryNote}
          </p>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <span className="text-xs text-zinc-600">Projetos com sinal</span>
          <strong className="mt-1 block text-xl font-semibold tabular-nums text-zinc-100">
            {allProjects.length.toLocaleString("pt-BR")}
          </strong>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <span className="text-xs text-zinc-600">Sem valor confiável</span>
          <strong className="mt-1 block text-xl font-semibold tabular-nums text-zinc-100">
            {unreliableValues.toLocaleString("pt-BR")}
          </strong>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <span className="text-xs text-zinc-600">Atraso com data inválida</span>
          <strong className="mt-1 block text-xl font-semibold tabular-nums text-zinc-100">
            {unreliableDates.toLocaleString("pt-BR")}
          </strong>
        </div>
      </section>

      <ObrasExplorer projects={allProjects} />

      <ObraList
        title="Paralisadas"
        subtitle={`top ${topParalisadas.length} por valor previsto`}
        accent="text-rose-300"
        projects={topParalisadas}
      />

      <ObraList
        title="Prazo vencido"
        subtitle={`top ${topAtrasadas.length} por tempo de atraso`}
        accent="text-orange-300"
        projects={topAtrasadas}
      />
    </div>
  );
}
