import type { Metadata } from "next";
import { getElections, getIndex } from "@/lib/data";
import ElectionsExplorer from "@/components/ElectionsExplorer";
export const metadata: Metadata = {
  title: "Eleições — GrafoBR",
  description:
    "Contexto eleitoral dos parlamentares acompanhados: candidaturas de 2026 e doações históricas de 2022, com fontes e períodos separados.",
};
export default async function ElectionsPage() {
  const [snapshot, index] = await Promise.all([getElections(), getIndex()]);
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-emerald-300">
          Dados eleitorais
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Eleições, com contexto</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Explore cada eleição no seu período, com origem e limites de cobertura
          visíveis.
        </p>
      </header>
      <ElectionsExplorer snapshot={snapshot} index={index} />
    </div>
  );
}
