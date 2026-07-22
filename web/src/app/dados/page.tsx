import type { Metadata } from "next";
import Link from "next/link";
import { getChanges, getIndex, getMeta, getObras, getQaReport, getSignals } from "@/lib/data";

export const metadata: Metadata = {
  title: "Dados e qualidade — GrafoBR",
  description:
    "Cobertura, atualização, critérios de confiança e limitações dos dados usados pelo GrafoBR.",
};

const SOURCE_NAMES: Record<string, string> = {
  camara: "Câmara",
  senado: "Senado",
  camara_ceap: "CEAP",
  cgu_emendas: "Emendas CGU",
  receita: "Receita/CNPJ",
  tse: "TSE",
  transparencia: "Contratos",
};

function Stat({
  label,
  value,
  help,
}: {
  label: string;
  value: string | number;
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

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="text-zinc-500 tabular-nums">
          {value.toLocaleString("pt-BR")} · {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-emerald-400/70"
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function DadosPage() {
  const [index, meta, obras, signals, changes, qa] = await Promise.all([
    getIndex(),
    getMeta(),
    getObras(),
    getSignals(),
    getChanges(),
    getQaReport(),
  ]);
  const sourceCounts = new Map<string, number>();
  for (const entry of index) {
    for (const source of entry.sources ?? []) {
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }
  }
  const camara = index.filter((e) => e.chamber !== "senado").length;
  const senado = index.filter((e) => e.chamber === "senado").length;
  const obrasTotal = obras?.all?.length ?? 0;
  const obrasNoValue =
    obras?.all?.filter((p) => !(typeof p.valorPrevisto === "number" && p.valorPrevisto > 1))
      .length ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-9">
      <header className="space-y-3 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Dados e qualidade</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
          Um painel curto sobre cobertura, atualização e grau de confiança. O
          GrafoBR mostra conexões documentais; não calcula risco, culpa ou intenção.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Parlamentares" value={index.length} help={`${camara} deputados · ${senado} senadores`} />
        <Stat label="Snapshot principal" value={formatDate(meta?.generatedAt)} />
        <Stat label="Obras com sinal" value={obrasTotal} help="Amostra Obrasgov.br" />
        <Stat label="Obras sem valor confiável" value={obrasNoValue} />
        <Stat
          label="Sinais calculados"
          value={
            (signals?.topContracts.length ?? 0) +
            (signals?.topEmendas.length ?? 0) +
            (signals?.topObras.length ?? 0) +
            (signals?.topCeap.length ?? 0)
          }
          help={signals ? formatDate(signals.generatedAt) : undefined}
        />
        <Stat
          label="Mudanças detectadas"
          value={
            (changes?.added.length ?? 0) +
            (changes?.removed.length ?? 0) +
            (changes?.changed.length ?? 0)
          }
          help={changes?.hasPrevious ? "vs. snapshot anterior" : "linha de base"}
        />
        <Stat
          label="Alertas QA"
          value={
            qa?.warnings.filter((warning) => warning.severity === "error" || warning.severity === "warn")
              .length ?? "—"
          }
          help={qa ? formatDate(qa.generatedAt) : "rode pnpm sync-data"}
        />
      </section>

      <section className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-emerald-200">
              Relatório QA build-time
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Checa integridade de nós/links, campos ausentes, valores sentinela
              de obras e lacunas de cobertura.
            </p>
          </div>
          <Link
            href="/dados/qa"
            className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            abrir QA
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-zinc-100">Cobertura por fonte</h2>
          <ul className="mt-4 space-y-3">
            {[...sourceCounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([source, count]) => (
                <Bar
                  key={source}
                  label={SOURCE_NAMES[source] ?? source}
                  value={count}
                  total={index.length}
                />
              ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h2 className="text-sm font-medium text-zinc-100">Rótulos de confiança</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-emerald-300">registro direto</dt>
              <dd className="text-xs leading-relaxed text-zinc-500">
                Dado publicado diretamente por fonte oficial, como TSE, CEAP ou CGU.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-sky-300">match forte / cadeia forte</dt>
              <dd className="text-xs leading-relaxed text-zinc-500">
                Pareamento conservador, como sócio por CPF mascarado + nome, ou empresa
                ligada ao parlamentar que aparece em contratos federais.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-amber-300">pista fraca / média</dt>
              <dd className="text-xs leading-relaxed text-zinc-500">
                Contexto para investigação, como obras no mesmo estado e tema de emenda.
                Não atribui autoria, responsabilidade ou financiamento.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-zinc-100">Limitações conhecidas</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-500 marker:text-zinc-700">
          <li>CPFs nunca são publicados; identificadores do grafo são opacos.</li>
          <li>Receita/CNPJ usa CPF mascarado, então sócios exigem pareamento conservador.</li>
          <li>As ligações societárias usam o snapshot Receita/CNPJ de maio de 2023; não afirmam situação societária atual.</li>
          <li>Senadores têm menos cruzamentos porque a base aberta do Senado não publica CPF.</li>
          <li>Obrasgov é tratado como amostra: a própria API não pagina listagens de forma confiável.</li>
          <li>Ausência de conexão significa ausência nas fontes usadas, não ausência no mundo real.</li>
        </ul>
        <p className="mt-4 text-xs text-zinc-600">
          Detalhes narrativos em <Link href="/sobre" className="text-emerald-300 hover:underline">Sobre e metodologia</Link>.
        </p>
      </section>
    </div>
  );
}
