import ContractFreshness from "@/components/ContractFreshness";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getStateContracts } from "@/lib/data";
import ContractsDirectory from "@/components/ContractsDirectory";
import ContractCoverage from "@/components/ContractCoverage";
import { contractPeriod, contractDirectoryData } from "@/lib/state-contracts";
export const metadata: Metadata = {
  title: "Contratos e fornecedores de SP, MG, RJ e DF — GrafoBR",
  description:
    "Explore contratos estaduais e distritais publicados no PNCP, seus fornecedores, valores iniciais e conexões documentais.",
  alternates: { canonical: "/contratos" },
};
export default async function ContractsPage() {
  const data = await getStateContracts();
  return (
    <div className="space-y-8">
      <header className="max-w-3xl pt-3 sm:pt-6">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-300">
          SP + MG + RJ + DF · CONTRATOS ESTADUAIS E DISTRITAIS · PNCP
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
          Quem fornece para o estado?
        </h1>
        <p className="mt-4 leading-relaxed text-zinc-400">
          Siga o caminho do órgão ao contrato e à empresa. Explore valores,
          documentos oficiais e conexões já registradas nos grafos.
          SP, MG e RJ: esfera estadual. DF: esfera distrital. Contratos federais ficam fora deste recorte.
        </p>
        {data && (
          <p className="mt-4 text-xs text-zinc-400">
            Publicações de {contractPeriod(data.period)} · valores iniciais, não
            pagamentos
          </p>
        )}
      </header>
      {data ? (
        <>
          <ContractFreshness
            fetchedAt={data.fetchedAt}
            refresh={data.refresh}
          />
          <Suspense fallback={<p>Carregando filtros…</p>}>
            <ContractsDirectory data={contractDirectoryData(data)} />
          </Suspense>
          <ContractCoverage data={data} />
        </>
      ) : (
        <p>Aguardando uma importação validada do PNCP.</p>
      )}
    </div>
  );
}
