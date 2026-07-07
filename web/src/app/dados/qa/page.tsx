import type { Metadata } from "next";
import Link from "next/link";
import { getQaReport } from "@/lib/data";

export const metadata: Metadata = {
  title: "Relatório QA — GrafoBR",
  description:
    "Relatório build-time de qualidade estrutural dos dados do GrafoBR.",
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Stat({
  label,
  value,
  help,
}: {
  label: string;
  value: number | string;
  help?: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <span className="text-xs text-zinc-600">{label}</span>
      <strong className="mt-1 block text-xl font-semibold tabular-nums text-zinc-100">
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </strong>
      {help ? <p className="mt-1 text-xs text-zinc-600">{help}</p> : null}
    </div>
  );
}

function severityClass(severity: string): string {
  if (severity === "error") return "bg-rose-500/10 text-rose-300 ring-rose-500/20";
  if (severity === "warn") return "bg-amber-500/10 text-amber-300 ring-amber-500/20";
  if (severity === "info") return "bg-sky-500/10 text-sky-300 ring-sky-500/20";
  return "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20";
}

function Table({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; count: number }[];
}) {
  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <h2 className="text-sm font-medium text-zinc-100">{title}</h2>
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="truncate text-zinc-400">{row.key}</dt>
            <dd className="shrink-0 tabular-nums text-zinc-200">
              {row.count.toLocaleString("pt-BR")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function QaPage() {
  const qa = await getQaReport();

  if (!qa) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/dados" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← dados
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-100">Relatório QA</h1>
        <p className="text-sm text-zinc-500">
          Nenhum `_qa.json` foi gerado ainda. Rode `pnpm sync-data`.
        </p>
      </div>
    );
  }

  const errorCount = qa.warnings.filter((warning) => warning.severity === "error").length;
  const warnCount = qa.warnings.filter((warning) => warning.severity === "warn").length;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-3 pt-4">
        <Link href="/dados" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← dados e qualidade
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
            Relatório QA
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Auditoria estrutural gerada no build. Ela encontra lacunas, IDs
            quebrados e dados sentinela; não acusa irregularidade.
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Perfis auditados" value={qa.totals.profiles} />
        <Stat label="Nós" value={qa.totals.nodes} />
        <Stat label="Vínculos" value={qa.totals.links} />
        <Stat
          label="Alertas"
          value={`${errorCount} erro · ${warnCount} aviso`}
          help={`QA: ${formatDate(qa.generatedAt)}`}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {qa.warnings.map((warning) => (
          <div
            key={warning.id}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-zinc-100">{warning.label}</h2>
              <span
                className={`rounded px-2 py-0.5 text-[11px] ring-1 ${severityClass(warning.severity)}`}
              >
                {warning.severity} · {warning.count.toLocaleString("pt-BR")}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {warning.detail}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Table title="Cobertura por fonte" rows={qa.coverage.bySource} />
        <Table title="Tipos de conexão" rows={qa.coverage.byConnectionType} />
        <Table title="Categorias de nó" rows={qa.coverage.byNodeCategory} />
        <Table title="Câmaras" rows={qa.coverage.byChamber} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-zinc-100">Campos ausentes</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {Object.entries(qa.missing).map(([key, count]) => (
              <div key={key} className="flex items-baseline justify-between gap-3">
                <dt className="text-zinc-400">{key}</dt>
                <dd className="tabular-nums text-zinc-200">
                  {count.toLocaleString("pt-BR")}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-zinc-100">Integridade</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {Object.entries(qa.broken).map(([key, count]) => (
              <div key={key} className="flex items-baseline justify-between gap-3">
                <dt className="text-zinc-400">{key}</dt>
                <dd className="tabular-nums text-zinc-200">
                  {count.toLocaleString("pt-BR")}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {qa.obras && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-zinc-100">Obrasgov</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-4">
            <Stat label="Obras auditadas" value={qa.obras.total} />
            <Stat label="Sem valor confiável" value={qa.obras.missingReliableValue} />
            <Stat label="Datas inválidas" value={qa.obras.invalidDates} />
            <Stat label="Sem UF" value={qa.obras.missingUf} />
          </dl>
        </section>
      )}

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-zinc-100">Amostras</h2>
        <dl className="mt-3 space-y-3 text-sm">
          {Object.entries(qa.samples).map(([key, values]) => (
            <div key={key}>
              <dt className="text-xs text-zinc-600">{key}</dt>
              <dd className="mt-1 font-mono text-xs text-zinc-400">
                {values.length ? JSON.stringify(values) : "[]"}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
