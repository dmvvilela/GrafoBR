import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEgo, getIndex } from "@/lib/data";
import InvestigationBoard from "@/components/InvestigationBoard";

export async function generateStaticParams() {
  const index = await getIndex();
  return index.map((entry) => ({ id: String(entry.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ego = await getEgo(id);
  return {
    title: ego?.meta?.egoName
      ? `Board ${ego.meta.egoName} — GrafoBR`
      : "Board de investigação — GrafoBR",
    description:
      "Selecione vínculos de um perfil e exporte um board de investigação estático.",
  };
}

export default async function InvestigationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ego, index] = await Promise.all([getEgo(id), getIndex()]);
  if (!ego) notFound();
  const entry = index.find((item) => String(item.id) === id) ?? null;

  return (
    <div className="space-y-7">
      <header className="max-w-3xl">
        <p className="text-xs tracking-wide text-zinc-500 uppercase">
          Investigação compartilhável
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">
          {ego.meta?.egoName ?? entry?.name}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Monte um recorte com vínculos selecionados. O estado fica na URL e o
          JSON exportado inclui explicações e fontes.
        </p>
      </header>
      <InvestigationBoard ego={ego} entry={entry} />
    </div>
  );
}
