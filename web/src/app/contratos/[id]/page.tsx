import { allKnownContracts } from "@/lib/contract-history";
import ContractEventList from "@/components/ContractEventList";
import ContractFreshness from "@/components/ContractFreshness";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStateContracts } from "@/lib/data";
import {
  contractDate,
  contractMoney,
  contractPeriod,
} from "@/lib/state-contracts";
import ContractShare from "@/components/ContractShare";
import ContractCoverage from "@/components/ContractCoverage";
import ContractVersion from "@/components/ContractVersion";
export const dynamicParams = false;

export async function generateStaticParams() {
  const data = await getStateContracts();
  return (data ? allKnownContracts(data) : []).map((c) => ({ id: c.id })) ?? [];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getStateContracts();
  const c = (data ? allKnownContracts(data) : []).find((c) => c.id === id);
  return {
    title: c
      ? `Contrato ${c.number}/${c.year} · ${c.uf} — GrafoBR`
      : "Contrato — GrafoBR",
    description: c?.object.slice(0, 160),
    alternates: { canonical: `/contratos/${id}` },
  };
}
export default async function ContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getStateContracts();
  const c = (data ? allKnownContracts(data) : []).find((c) => c.id === id);
  if (!data || !c) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <Link
        href={`/contratos?uf=${c.uf}`}
        className="inline-block py-2 text-sm text-zinc-400"
      >
        ← Contratos de {c.uf}
      </Link>
      <ContractVersion version={data.version} />
      {!data.contracts.some((row) => row.id === id) && (
        <p className="rounded-xl border border-amber-300/30 p-4 text-sm text-amber-200">
          Este registro não retornou na última consulta completa. Exibimos a
          última versão observada; isso não significa cancelamento.
        </p>
      )}
      <header>
        <p className="text-xs uppercase tracking-widest text-emerald-300">
          PNCP · CONTRATO ESTADUAL · {c.uf}
        </p>
        <h1 className="mt-4 break-words text-3xl font-semibold sm:text-4xl">
          Contrato {c.number}/{c.year}
        </h1>
        <p className="mt-4 text-sm text-zinc-400">
          Publicado em {contractDate(c.publishedAt)} · atualizado na fonte em{" "}
          {contractDate(c.updatedAt)}
        </p>
      </header>
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
        <p className="text-xs uppercase tracking-wider text-zinc-400">
          Valor inicial nominal
        </p>
        <p className="mt-3 break-words text-2xl font-semibold text-indigo-200 sm:text-4xl">
          {contractMoney(c.initialValue)}
        </p>
        <p className="mt-3 text-sm text-zinc-400">
          Não representa pagamentos. Aditivos e reajustes posteriores não estão
          somados.
        </p>
        <h2 className="mt-7 font-medium">Objeto do contrato</h2>
        <p className="mt-3 break-words text-sm leading-relaxed text-zinc-300">
          {c.object}
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-white/10 p-5">
          <p className="text-xs text-zinc-500">ÓRGÃO CONTRATANTE</p>
          <h2 className="mt-3 break-words font-medium">{c.agency}</h2>
          <p className="mt-3 break-words text-sm text-zinc-400">
            Unidade: {c.unit}
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Poder{" "}
            {{ E: "Executivo", L: "Legislativo", J: "Judiciário" }[c.power]} ·
            esfera estadual
          </p>
        </div>
        <div className="min-w-0 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.03] p-5">
          <p className="text-xs text-emerald-300">FORNECEDOR NO REGISTRO</p>
          <h2 className="mt-3 break-words font-medium">{c.supplierName}</h2>
          <Link
            href={`/fornecedores/${c.supplierId}`}
            className="mt-4 inline-block py-2 text-sm text-emerald-300"
          >
            Ver contratos e grafo do fornecedor →
          </Link>
        </div>
      </section>
      <dl className="grid gap-4 rounded-2xl border border-white/10 p-5 sm:grid-cols-3">
        {[
          ["Assinatura", c.signedAt],
          ["Início da vigência", c.startsAt],
          ["Fim da vigência", c.endsAt],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="mt-2 text-sm">{contractDate(value)}</dd>
          </div>
        ))}
      </dl>
      <a
        href={c.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="block rounded-xl border border-emerald-300/30 px-5 py-4 text-center text-sm text-emerald-300"
      >
        Consultar registro e documentos oficiais no PNCP ↗
      </a>
      <section id="historico" className="space-y-4">
        <h2 className="text-2xl font-semibold">Histórico observado</h2>
        <p className="text-sm text-zinc-400">
          Acompanhamento desde{" "}
          {contractDate(data.history?.baselineAt ?? data.fetchedAt)}. As datas
          abaixo indicam quando observamos os registros; não reconstituem
          alterações anteriores à primeira consulta.
        </p>
        <ContractEventList
          events={[...(data.history?.events ?? [])]
            .reverse()
            .filter((e) => (e.after ?? e.before)?.id === id)}
        />
        {!(data.history?.events ?? []).some(
          (e) => (e.after ?? e.before)?.id === id,
        ) && (
          <p className="text-sm text-zinc-400">
            Nenhuma alteração observada desde a referência inicial.
          </p>
        )}
      </section>
      <ContractFreshness fetchedAt={data.fetchedAt} refresh={data.refresh} />
      <ContractShare
        title={`Contrato ${c.number}/${c.year} · ${c.uf}`}
        amount={contractMoney(c.initialValue)}
        facts={[
          `Fornecedor: ${c.supplierName}`,
          `Objeto: ${c.object.length > 220 ? c.object.slice(0, 220) + "…" : c.object}`,
          `Órgão: ${c.agency}`,
          `Publicado em ${contractDate(c.publishedAt)}. Assinatura: ${contractDate(c.signedAt)}.`,
          `Recorte de publicações: ${contractPeriod(data.period)}.`,
        ]}
        path={`/contratos/${c.id}`}
        version={data.version}
      />
      <ContractCoverage data={data} />
    </div>
  );
}
