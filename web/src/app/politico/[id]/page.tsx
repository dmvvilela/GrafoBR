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
