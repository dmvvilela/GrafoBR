import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEgo, getIndex, getElections, getPress } from "@/lib/data";
import EgoView from "@/components/EgoView";
import ProfileContext from "@/components/ProfileContext";
import SourceFreshness from "@/components/SourceFreshness";

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
  const name = ego?.meta?.egoName;
  return {
    title: name ? `${name} — GrafoBR` : "GrafoBR",
    description: name
      ? `Conexões de dados públicos de ${name}: doadores, despesas, empresas e contratos.`
      : undefined,
  };
}

export default async function PoliticoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ego = await getEgo(id);
  if (!ego) notFound();

  const index = await getIndex();
  const entry = index.find((e) => String(e.id) === id) ?? null;

  const [elections, press] = await Promise.all([getElections(), getPress()]);
  return (
    <>
      {entry?.chamber === "governo" && entry.uf && <Link href={`/estados?a=${entry.uf}&b=${entry.uf === "SP" ? "MG" : "SP"}`} className="mb-6 block rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4 text-sm text-emerald-200">Compare as despesas de {entry.uf} com outros estados →<span className="mt-1 block text-xs text-zinc-400">Contas estaduais de anos completos. Não representam despesas pessoais do titular atual.</span></Link>}
      <EgoView ego={ego} entry={entry} />
      <ProfileContext
        snapshot={elections}
        election={elections?.entries.find((e) => e.politicianId === Number(id))}
        articles={press.filter((a) => a.politicianIds.includes(Number(id)))}
      />
      <div className="mt-5">
        <SourceFreshness
          generatedAt={ego.meta.generatedAt}
          coverage={ego.meta.sourceCoverage}
        />
      </div>
    </>
  );
}
