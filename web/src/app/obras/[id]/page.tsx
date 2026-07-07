import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getObras } from "@/lib/data";
import type { ObraProject } from "@/lib/data";

function brl(value: number | null | undefined): string {
  if (typeof value !== "number" || value <= 1) return "—";
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

function validDate(value: string | null | undefined): boolean {
  if (!value) return false;
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) && year >= 1990;
}

function dateBR(value: string | null | undefined): string {
  if (!value || !validDate(value)) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

function signalLabel(signal: string): string {
  const labels: Record<string, string> = {
    paralisada: "Paralisada",
    atrasada: "Prazo vencido",
    baixo_avanco: "Baixo avanço físico",
    empenho_acima_previsto: "Empenho acima do previsto",
  };
  return labels[signal] ?? signal;
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
      {signalLabel(signal)}
    </span>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <dt className="text-xs text-zinc-600">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-zinc-200">{value}</dd>
    </div>
  );
}

async function findProject(id: string): Promise<ObraProject | null> {
  const data = await getObras();
  if (!data) return null;
  return (data.all ?? []).find((project) => project.id === id) ?? null;
}

export async function generateStaticParams() {
  const data = await getObras();
  return (data?.all ?? []).map((project) => ({ id: project.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await findProject(decodeURIComponent(id));
  if (!project) return { title: "Obra não encontrada — GrafoBR" };
  return {
    title: `${project.nome || project.id} — Obras públicas — GrafoBR`,
    description:
      "Registro de obra pública federal com sinais de acompanhamento no Obrasgov.br.",
  };
}

export default async function ObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await findProject(decodeURIComponent(id));
  if (!project) notFound();

  const sourceId = project.sourceIds?.idUnico ?? project.id;
  const unreliableDate =
    !validDate(project.dataFinalPrevista) &&
    Boolean(project.dataFinalPrevistaOriginal ?? project.dataFinalPrevista);
  const unreliableValue =
    !(typeof project.valorPrevisto === "number" && project.valorPrevisto > 1) &&
    typeof project.valorPrevistoOriginal === "number";

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <Link
        href="/obras"
        className="inline-flex text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        ← obras públicas
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {project.signals.map((signal) => (
            <SignalBadge key={signal} signal={signal} />
          ))}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          {project.nome || `CIPI ${project.id}`}
        </h1>
        <p className="text-sm leading-relaxed text-zinc-500">
          Registro público do Obrasgov.br. Esta página mostra sinais de
          acompanhamento, não acusação de irregularidade.
        </p>
        <a
          href="https://www.gov.br/obrasgov/pt-br/acesso-a-informacao/dados-abertos-obrasgov"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-xs text-emerald-300 hover:underline"
        >
          Fonte: dados abertos Obrasgov.br
        </a>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Field label="CIPI" value={<span className="font-mono">{sourceId}</span>} />
        <Field label="UF" value={project.uf ?? "—"} />
        <Field label="Município" value={project.municipio ?? "—"} />
        <Field label="Situação" value={project.situacao ?? "—"} />
        <Field
          label="Valor previsto"
          value={
            <>
              {brl(project.valorPrevisto)}
              {unreliableValue ? (
                <span className="ml-1 text-xs text-zinc-600">
                  valor bruto tratado como não confiável
                </span>
              ) : null}
            </>
          }
        />
        <Field label="Valor empenhado" value={brl(project.valorEmpenhado)} />
        <Field label="Avanço físico" value={pct(project.percentualFisico)} />
        <Field
          label="Prazo previsto"
          value={
            <>
              {dateBR(project.dataFinalPrevista)}
              {unreliableDate ? (
                <span className="ml-1 text-xs text-zinc-600">
                  data bruta ignorada
                </span>
              ) : null}
            </>
          }
        />
      </dl>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-zinc-100">Execução e repasse</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-xs text-zinc-600">Executor</dt>
            <dd className="text-zinc-300">{project.executor ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-600">Repassador</dt>
            <dd className="text-zinc-300">{project.repassador ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-600">Órgão</dt>
            <dd className="text-zinc-300">{project.orgao ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-zinc-100">Registro de origem</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-600">ID interno GrafoBR</dt>
            <dd className="font-mono text-zinc-300">{project.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-600">ID único Obrasgov</dt>
            <dd className="font-mono text-zinc-300">
              {project.sourceIds?.idUnico ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-600">Projeto de investimento</dt>
            <dd className="font-mono text-zinc-300">
              {project.sourceIds?.idProjetoInvestimento ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-600">Código município</dt>
            <dd className="font-mono text-zinc-300">
              {project.codigoMunicipio ?? "—"}
            </dd>
          </div>
        </dl>
        <a
          href="https://www.gov.br/obrasgov/pt-br/acesso-a-informacao/dados-abertos-obrasgov"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex text-xs text-emerald-300 hover:underline"
        >
          Abrir catálogo de dados abertos Obrasgov.br
        </a>
      </section>

      {(project.motivosParalisacao?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-zinc-100">
            Motivos registrados
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-zinc-500 marker:text-zinc-700">
            {project.motivosParalisacao!.map((motivo) => (
              <li key={motivo}>{motivo}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs leading-relaxed text-zinc-600">
        Valores de R$0/R$0,01 e datas sentinela antigas são tratados como sem
        dado confiável. A amostra de obras vem da API Obrasgov.br, cuja paginação
        pública não é confiável para inventário completo.
      </p>
    </div>
  );
}
