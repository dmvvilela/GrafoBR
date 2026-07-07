import type { Metadata } from "next";
import RankingsExplorer from "@/components/RankingsExplorer";
import {
  getCeapRanking,
  getContractRanking,
  getEmendaRanking,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "Rankings — GrafoBR",
  description:
    "Rankings filtráveis de emendas, CEAP e empresas de deputados com contratos federais.",
};

export default async function RankingsPage() {
  const [emendas, ceap, contracts] = await Promise.all([
    getEmendaRanking(),
    getCeapRanking(),
    getContractRanking(),
  ]);

  return (
    <div className="space-y-8">
      <header className="pt-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Rankings</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
          Fluxos de dinheiro público, agora com filtros e exportação. Conexões
          de registros oficiais —{" "}
          <span className="text-zinc-500">investigue antes de concluir</span>.
        </p>
      </header>
      <RankingsExplorer emendas={emendas} ceap={ceap} contracts={contracts} />
    </div>
  );
}
