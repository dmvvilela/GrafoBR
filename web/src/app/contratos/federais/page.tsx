import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getFederalContracts } from "@/lib/federal-data";
import {
  summarizeFederalContracts,
  federalHistoryBatches,
} from "@/lib/federal-contracts";
import { contractPeriod, contractObservedAt } from "@/lib/state-contracts";
import FederalContractsDashboard from "@/components/FederalContractsDashboard";
export const metadata: Metadata = {
  title: "Contratos federais — GrafoBR",
  description:
    "Contratos de órgãos federais publicados no PNCP: valores iniciais, órgãos e fornecedores. Totais separados dos estados e do Distrito Federal.",
  alternates: { canonical: "/contratos/federais" },
};
export default async function Page() {
  const data = await getFederalContracts();
  return (
    <div className="space-y-8 py-3 sm:py-6">
      <header className="rounded-3xl border border-sky-300/20 bg-gradient-to-br from-sky-400/10 to-indigo-400/5 p-5 sm:p-9">
        <nav
          aria-label="Esfera dos contratos"
          className="flex flex-wrap gap-3 text-sm"
        >
          <Link
            href="/contratos"
            className="rounded-full border border-white/15 px-4 py-2 text-zinc-300"
          >
            Estados e DF
          </Link>
          <Link
            href="/contratos/federais"
            aria-current="page"
            className="rounded-full border border-sky-300/50 bg-sky-300/10 px-4 py-2 text-sky-200"
          >
            Federal
          </Link>
        </nav>
        <p className="mt-7 text-xs uppercase tracking-widest text-sky-300">
          UNIÃO · CONTRATOS FEDERAIS · PNCP
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          Quem fornece para a União?
        </h1>
        <p className="mt-5 max-w-3xl leading-relaxed text-zinc-300">
          Explore contratos de órgãos federais em todo o país. Órgãos da União
          sediados no DF também entram aqui. Estes valores não compõem os totais
          estaduais ou distritais de{" "}
          <Link href="/meu-estado" className="text-sky-200 underline">
            Meu estado
          </Link>
          .
        </p>
        <p className="mt-5 text-sm text-zinc-400">
          Publicações de {contractPeriod(data.period)} · valores iniciais
          nominais, não pagamentos.
        </p>
      </header>
      <aside className="rounded-xl border border-white/10 p-4 text-sm leading-relaxed text-zinc-400">
        <p>
          Coleta nacional concluída em {contractObservedAt(data.fetchedAt)}.
          Atualizações são publicadas após validação; não há consulta ao vivo.
        </p>
        {data.collection.mode === "validated-cache" && (
          <p className="mt-2">
            Primeiro recorte federal extraído da coleta nacional já realizada,
            com todas as páginas revalidadas e a data original da coleta
            preservada.
          </p>
        )}
        {data.refresh.status !== "success" && (
          <p className="mt-2 text-amber-200">
            A última tentativa não foi concluída. Mantivemos os dados da última
            coleta completa.
          </p>
        )}
      </aside>
      <Suspense fallback={<p>Carregando painel federal…</p>}>
        <FederalContractsDashboard
          version={data.version}
          initialSummary={summarizeFederalContracts(data.contracts)}
        />
      </Suspense>
      <section
        aria-labelledby="federal-history"
        className="rounded-2xl border border-white/10 p-5 sm:p-7"
      >
        <h2 id="federal-history" className="text-xl font-semibold">
          Histórico federal
        </h2>
        <p className="mt-3 text-sm text-zinc-400">
          Observação inicial: {contractObservedAt(data.history.baselineAt)}.
          Histórico independente dos estados e do DF. A primeira importação
          estabelece a referência, sem tratar os contratos existentes como novas
          ocorrências.
        </p>
        {data.history.events.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-300">
            Ainda não há alterações observadas após a referência inicial.
          </p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {federalHistoryBatches(data.history).map((b) => (
              <li key={b.sequence}>
                {contractObservedAt(b.observedAt)}: {b.added} entradas,{" "}
                {b.changed} alterações e {b.removed} saídas do recorte.
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          Entrada ou saída do recorte não significa assinatura ou cancelamento.
          O arquivo de dados preserva os registros anteriores e posteriores de
          cada alteração.
        </p>
      </section>
      <section className="rounded-2xl border border-white/10 p-5 text-sm leading-relaxed text-zinc-400 sm:p-7">
        <h2 className="text-xl font-semibold text-zinc-100">
          Fonte e limites do recorte
        </h2>
        <p className="mt-4">
          Fonte:{" "}
          <a
            href="https://pncp.gov.br"
            target="_blank"
            rel="noreferrer"
            className="text-sky-300 underline"
          >
            Portal Nacional de Contratações Públicas
          </a>
          . Foram conferidos{" "}
          {data.coverage.nationalRecordsChecked.toLocaleString("pt-BR")}{" "}
          registros nacionais em {data.coverage.days.length} dias, dos quais{" "}
          {data.coverage.federalRecordsChecked.toLocaleString("pt-BR")}{" "}
          pertenciam à esfera federal antes das exclusões.
        </p>
        <p className="mt-3">
          Somente esfera federal (F), instrumento contrato (tipo 1), despesa e
          fornecedor pessoa jurídica com identificação validada. Outros
          instrumentos, receitas, pessoas físicas, fornecedores sem
          identificação válida e contratos sub-rogados ficam fora. Estados (E),
          municípios (M), DF (D) e esfera não informada não entram nos totais.
        </p>
        <p className="mt-3">
          A UF é a localização da unidade contratante, não o destino do gasto ou
          a esfera do governo. “EX” indica unidade no exterior. O valor inicial
          não representa pagamentos, aditivos, execução orçamentária ou gasto
          anual da União. A cobertura depende das publicações dos órgãos no PNCP
          e não equivale a todos os contratos federais existentes.
        </p>
        <details className="mt-4">
          <summary className="cursor-pointer text-zinc-200">
            Registros excluídos por critério
          </summary>
          <ul className="mt-3 space-y-1">
            {Object.entries(data.coverage.excluded).map(([key, count]) => (
              <li key={key}>
                {(
                  {
                    transferred: "Sub-rogados",
                    otherInstrument: "Outros instrumentos",
                    revenueOrUnknown: "Receita ou natureza não informada",
                    notCompany: "Fornecedor não é pessoa jurídica",
                    invalidCompanyId: "Identificação do fornecedor inválida",
                    invalidAgencyId: "Identificação do órgão inválida",
                    invalidAmount: "Valor inicial inválido",
                  } as Record<string, string>
                )[key] ?? key}
                : {count.toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
        </details>
        <a
          href="/data/_federal-contracts.json"
          className="mt-4 inline-block py-2 text-sky-300 underline"
        >
          Baixar dados e histórico federais (JSON)
        </a>
      </section>
    </div>
  );
}
export const dynamic = "force-static";
