import type { Metadata } from "next";
import { getIndex } from "@/lib/data";
import ComparePoliticians from "@/components/ComparePoliticians";

export const metadata: Metadata = {
  title: "Comparar parlamentares — GrafoBR",
  description:
    "Compare dois perfis por vínculos, fontes e nós em comum nos dados públicos carregados.",
};

export default async function CompararPage() {
  const entries = await getIndex();
  return (
    <div className="space-y-7">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Comparar parlamentares
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Coloque dois perfis lado a lado para ver diferenças de fontes,
          categorias e vínculos. A comparação usa os mesmos arquivos estáticos
          dos grafos individuais.
        </p>
      </header>
      <ComparePoliticians entries={entries} />
    </div>
  );
}
