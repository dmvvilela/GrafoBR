import Link from "next/link";
import type { Metadata } from "next";
import { getIndex, getStateSpending } from "@/lib/data";
import StateSpendingComparison from "@/components/StateSpendingComparison";

export const metadata: Metadata = {
  title: "Compare os gastos dos estados — GrafoBR",
  description: "Saúde, educação, segurança e investimentos: compare despesas anuais dos estados por habitante, participação e valor total. Dados oficiais do Tesouro e IBGE.",
  alternates: { canonical: "/estados" },
};
export default async function StatesPage() {
  const [data,index] = await Promise.all([getStateSpending(),getIndex()]);
  return <div className="space-y-8">
    <header className="max-w-3xl pt-3 sm:pt-6"><p className="text-xs font-medium uppercase tracking-widest text-emerald-300">CONTAS DOS ESTADOS · TESOURO + IBGE</p><h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Para onde vai o dinheiro dos estados?</h1><p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">Compare duas unidades da federação, entenda as prioridades do gasto e compartilhe os números com suas fontes.</p>{data&&<p className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">{data.states.length} unidades da federação · {data.years.join(" e ")} · anos completos</p>}</header>
    <Link href="/meu-estado" className="inline-block text-sm text-emerald-300">Meu estado: painéis de SP e MG com gastos, fornecedores e contratos →</Link>
    <Link href="/contratos" className="inline-block text-sm text-emerald-300">Explore também contratos e fornecedores estaduais de SP e MG →</Link>
    {data?<StateSpendingComparison data={data} governors={index.filter(e=>e.chamber==="governo"&&e.uf&&e.office).map(e=>({uf:e.uf!,id:e.id,name:e.name,verifiedAt:e.office!.verifiedAt}))}/>:<p className="rounded-xl border border-white/10 p-6 text-zinc-400">A comparação aguarda uma importação validada dos dados oficiais. Nenhum valor estimado foi substituído por zero.</p>}
  </div>;
}
