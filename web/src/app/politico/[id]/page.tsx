import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEgo, getIndex, getElections, getPress, getStateContracts } from "@/lib/data";
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

  const [elections, press, stateContracts] = await Promise.all([getElections(), getPress(), getStateContracts()]);
  const stateSuppliers = (stateContracts?.suppliers ?? []).flatMap(s => s.connections.filter(c => c.profileId === Number(id)).map(c => {
    const records = stateContracts!.contracts.filter(r => r.supplierId === s.id);
    return { id:s.id, nodeId:c.nodeId, count:records.length };
  }));
  return (
    <>
      {entry?.chamber === "governo" && entry.uf && <Link href={`/estados?a=${entry.uf}&b=${entry.uf === "SP" ? "MG" : "SP"}`} className="mb-6 block rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4 text-sm text-emerald-200">Compare as despesas de {entry.uf} com outros estados →<span className="mt-1 block text-xs text-zinc-400">Contas estaduais de anos completos. Não representam despesas pessoais do titular atual.</span></Link>}
      {entry?.chamber === "governo" && ["SP", "MG"].includes(entry.uf ?? "") && <Link href={`/contratos?uf=${entry.uf}`} className="mb-6 block rounded-xl border border-white/10 p-4 text-sm text-emerald-200">Explore os contratos estaduais de {entry.uf} no PNCP →<span className="mt-1 block text-xs text-zinc-400">Órgãos, fornecedores e documentos. Não representa contratação pessoal do governador.</span></Link>}
      <EgoView ego={ego} entry={entry} stateSuppliers={stateSuppliers} />
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
