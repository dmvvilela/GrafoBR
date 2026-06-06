import type { Metadata } from "next";
import { getIndex } from "@/lib/data";
import SearchAll from "@/components/SearchAll";

export const metadata: Metadata = {
  title: "Buscar — GrafoBR",
  description:
    "Busque um deputado, empresa, fornecedor ou doador e veja todas as conexões registradas em dados públicos.",
};

export default async function BuscarPage() {
  const index = await getIndex();
  return (
    <div className="space-y-7">
      <header className="pt-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Buscar conexões</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
          Comece por um nome — deputado, empresa, fornecedor ou doador — e explore
          as conexões registradas entre eles.
        </p>
      </header>
      <SearchAll index={index} />
    </div>
  );
}
