import ChangeShare from "@/components/ChangeShare";
import ContractVersion from "@/components/ContractVersion";
import Link from "next/link";
import { getStateContracts } from "@/lib/data";
import {
  contractHistoryBaselines,
  contractObservedAt,
  contractPeriod,
} from "@/lib/state-contracts";
import ContractHistoryFeed from "@/components/ContractHistoryFeed";
import ContractFreshness from "@/components/ContractFreshness";
export const metadata = {
  title: "O que mudou nos contratos — GrafoBR",
  alternates: { canonical: "/contratos/historico" },
};
export default async function Page() {
  const data = await getStateContracts();
  if (!data) return <p>Histórico aguardando uma consulta validada.</p>;
  const baselines = data.history ? contractHistoryBaselines(data.history) : [];
  const events = data.history?.events ?? [];
  const version = `${data.version}-${data.history?.sequence ?? 0}`;
  const counts = ["added", "changed", "removed"].map(
    (kind) => events.filter((e) => e.kind === kind).length,
  );
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <ContractVersion version={version} />
      <header>
        <p className="text-xs tracking-widest text-emerald-300">
          SP + MG + RJ + DF · MEMÓRIA DOS REGISTROS
        </p>
        <h1 className="mt-4 text-3xl font-semibold sm:text-5xl">
          O que mudou nos contratos
        </h1>
        <p className="mt-4 leading-relaxed text-zinc-400">
          Entradas, alterações e registros que deixaram de retornar em consultas
          completas ao PNCP. Cada UF tem sua própria data inicial de observação.
          A primeira consulta estabelece a referência, sem transformar contratos
          anteriores em novidades.
        </p>
        <p className="mt-3 text-sm text-zinc-400">
          Uma mudança no registro não comprova um aditivo, pagamento ou
          irregularidade. Não retornar na consulta não significa cancelamento.
        </p>
        <Link
          href="/acompanhando"
          className="mt-4 inline-block py-3 text-emerald-300"
        >
          Acompanhe seus estados e fornecedores →
        </Link>
      </header>
      <ContractFreshness fetchedAt={data.fetchedAt} refresh={data.refresh} />
      <p className="text-sm leading-relaxed text-zinc-400">
        Início do histórico por UF: {baselines.join(" ")}
      </p>
      <ContractHistoryFeed events={events} />
      <ChangeShare
        summary
        title="SP + MG + RJ + DF · histórico observado"
        path={`/contratos/historico?v=${version}`}
        lines={[
          ...baselines,
          `${counts[0]} entradas no recorte · ${counts[1]} alterações · ${counts[2]} registros que não retornaram.`,
          `${data.contracts.length.toLocaleString("pt-BR")} contratos na última consulta completa: ${contractObservedAt(data.fetchedAt)}.`,
          `Publicações de ${contractPeriod(data.period)}. Fonte: PNCP.`,
          "A primeira consulta estabelece a referência. Ausência de mudanças observadas não significa ausência de mudanças fora da cobertura.",
        ]}
      />
    </div>
  );
}
