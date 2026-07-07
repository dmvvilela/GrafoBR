"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ObraProject } from "@/lib/data";
import ExportButton from "@/components/ExportButton";

function isReliableMoney(value: number | null | undefined): value is number {
  return typeof value === "number" && value > 1;
}

function isReliableDate(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const year = Number(iso.slice(0, 4));
  return Number.isFinite(year) && year >= 1990;
}

function brl(value: number | null | undefined): string {
  if (!isReliableMoney(value)) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function pct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("pt-BR")}%`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso || !isReliableDate(iso)) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

function formatAtraso(days: number): string {
  if (days < 1) return "";
  if (days === 1) return "1 dia de atraso";
  if (days < 60) return `${days} dias de atraso`;
  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30);
  if (years === 0) return months <= 1 ? "1 mês de atraso" : `${months} meses de atraso`;
  const yPart = years === 1 ? "1 ano" : `${years} anos`;
  if (months <= 0) return `${yPart} de atraso`;
  const mPart = months === 1 ? "1 mês" : `${months} meses`;
  return `${yPart} e ${mPart} de atraso`;
}

function optionLabel(signal: string): string {
  const labels: Record<string, string> = {
    paralisada: "Paralisadas",
    atrasada: "Prazo vencido",
    baixo_avanco: "Baixo avanço",
    empenho_acima_previsto: "Empenho acima do previsto",
  };
  return labels[signal] ?? signal;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function projectValue(project: ObraProject): number {
  return isReliableMoney(project.valorPrevisto) ? project.valorPrevisto : 0;
}

function projectDelay(project: ObraProject): number {
  return isReliableDate(project.dataFinalPrevista)
    ? (project.diasAtraso ?? 0)
    : 0;
}

function projectScore(project: ObraProject): number {
  const signals = new Set(project.signals);
  return (
    (signals.has("paralisada") ? 3_000_000_000 : 0) +
    (signals.has("atrasada") ? 2_000_000_000 : 0) +
    (signals.has("baixo_avanco") ? 1_000_000_000 : 0) +
    projectValue(project) +
    projectDelay(project) * 1000
  );
}

function SignalBadge({ signal }: { signal: string }) {
  const styles: Record<string, string> = {
    paralisada: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
    atrasada: "bg-orange-500/15 text-orange-300 ring-orange-500/25",
    baixo_avanco: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
    empenho_acima_previsto: "bg-yellow-500/15 text-yellow-200 ring-yellow-500/25",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${styles[signal] ?? "bg-zinc-500/15 text-zinc-400 ring-zinc-500/25"}`}
    >
      {optionLabel(signal)}
    </span>
  );
}

function ProjectRow({ project, rank }: { project: ObraProject; rank: number }) {
  const href = `/obras/${encodeURIComponent(project.id)}`;
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
                {projectDelay(project) > 0 && (
                  <span className="ml-1 block text-orange-400 sm:inline">
                    {formatAtraso(projectDelay(project))}
                  </span>
                )}
              </dd>
            </div>
          </dl>
          {(project.executor || project.repassador) && (
            <p className="text-xs text-zinc-600">
              {project.repassador ? (
                <>
                  Repasse: <span className="text-zinc-500">{project.repassador}</span>
                </>
              ) : null}
              {project.executor ? (
                <>
                  {project.repassador ? " · " : ""}
                  Executor: <span className="text-zinc-500">{project.executor}</span>
                </>
              ) : null}
            </p>
          )}
          <p className="font-mono text-[10px] text-zinc-700">
            CIPI {project.sourceIds?.idUnico ?? project.id}
          </p>
        </div>
      </div>
    </li>
  );
}

export default function ObrasExplorer({ projects }: { projects: ObraProject[] }) {
  const [uf, setUf] = useState("");
  const [signal, setSignal] = useState("");
  const [query, setQuery] = useState("");

  const ufs = useMemo(
    () =>
      [...new Set(projects.map((p) => p.uf).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "pt-BR"),
      ),
    [projects],
  );
  const signals = useMemo(
    () =>
      [...new Set(projects.flatMap((p) => p.signals ?? []))].sort((a, b) =>
        optionLabel(a).localeCompare(optionLabel(b), "pt-BR"),
      ),
    [projects],
  );
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return projects
      .filter((p) => !uf || p.uf === uf)
      .filter((p) => !signal || p.signals.includes(signal))
      .filter((p) => {
        if (!q) return true;
        return normalize(
          [
            p.nome,
            p.uf,
            p.municipio,
            p.executor,
            p.repassador,
            p.orgao,
            p.id,
          ].join(" "),
        ).includes(q);
      })
      .toSorted((a, b) => projectScore(b) - projectScore(a));
  }, [projects, query, signal, uf]);
  const shown = filtered.slice(0, 100);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Explorar obras</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Filtre a amostra por estado, sinal e texto. A ordenação prioriza paralisia,
          prazo vencido, baixo avanço, valor confiável e dias de atraso.
        </p>
      </div>
      <div className="grid gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-3 sm:grid-cols-[1fr_1fr_2fr]">
        <select
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0c0c12] px-3 py-2 text-sm text-zinc-100 outline-none"
        >
          <option value="">Todos os estados</option>
          {ufs.map((item) => (
            <option key={item} value={item ?? ""}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={signal}
          onChange={(e) => setSignal(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0c0c12] px-3 py-2 text-sm text-zinc-100 outline-none"
        >
          <option value="">Todos os sinais</option>
          {signals.map((item) => (
            <option key={item} value={item}>
              {optionLabel(item)}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, executor, órgão ou CIPI"
          className="rounded-xl border border-white/10 bg-[#0c0c12] px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Resultado filtrado</h2>
          <span className="text-xs text-zinc-500">
            {shown.length.toLocaleString("pt-BR")} de{" "}
            {filtered.length.toLocaleString("pt-BR")}
          </span>
        </div>
        <ExportButton
          filename="obras-filtradas.csv"
          rows={filtered.map((project) => ({
            id: project.id,
            nome: project.nome,
            uf: project.uf,
            municipio: project.municipio,
            situacao: project.situacao,
            sinais: project.signals.join("|"),
            valorPrevisto: project.valorPrevisto,
            valorEmpenhado: project.valorEmpenhado,
            percentualFisico: project.percentualFisico,
            dataFinalPrevista: project.dataFinalPrevista,
            executor: project.executor,
            repassador: project.repassador,
            orgao: project.orgao,
          }))}
          label="CSV"
        />
      </div>
      <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
        {shown.map((project, i) => (
          <ProjectRow key={project.id} project={project} rank={i + 1} />
        ))}
      </ol>
    </section>
  );
}
