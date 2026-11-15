import { allKnownSuppliers, eventMatches } from "@/lib/contract-history";
import FollowButton from "@/components/FollowButton";
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
  RELATION_NAMES,
  contractProfilePath,
} from "@/lib/state-contracts";
import { supplierGraph } from "@/lib/supplier-graph";
import SupplierGraph from "@/components/SupplierGraph";
import ContractShare from "@/components/ContractShare";
import ContractCoverage from "@/components/ContractCoverage";
import ContractVersion from "@/components/ContractVersion";
export const dynamicParams = false;

export async function generateStaticParams() {
  const data = await getStateContracts();
  return (data ? allKnownSuppliers(data) : []).map((s) => ({ id: s.id })) ?? [];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getStateContracts();
  const s = (data ? allKnownSuppliers(data) : []).find((s) => s.id === id);
  return {
    title: s
      ? `${s.name} · contratos estaduais e distritais — GrafoBR`
      : "Fornecedor — GrafoBR",
    description:
      "Contratos estaduais e distritais publicados no PNCP e conexões documentais verificadas.",
    alternates: { canonical: `/fornecedores/${id}` },
  };
}
export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getStateContracts();
  const supplier = (data ? allKnownSuppliers(data) : []).find(
    (s) => s.id === id,
  );
  if (!data || !supplier) notFound();
  const contracts = data.contracts.filter((c) => c.supplierId === id),
    total = contracts.reduce((sum, c) => sum + c.initialValue, 0),
    ufs = [...new Set(contracts.map((c) => c.uf))],
    graph = await supplierGraph(supplier, contracts);
  return (
    <div className="space-y-7">
      <Link
        href="/contratos?view=suppliers"
        className="inline-block py-2 text-sm text-zinc-400"
      >
        ← Fornecedores dos estados e do DF
      </Link>
      <ContractVersion version={data.version} />
      <header className="max-w-4xl">
        <p className="text-xs uppercase tracking-widest text-emerald-300">
          FORNECEDOR · {ufs.join(" + ")} · PNCP
        </p>
        <h1 className="mt-4 break-words text-2xl font-semibold tracking-tight sm:text-4xl">
          {supplier.name}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Matriz e filiais da mesma raiz documental. Publicações de{" "}
          {contractPeriod(data.period)}. O nome exibido é o do registro
          atualizado mais recentemente neste recorte.
        </p>
      </header>
      <FollowButton
        target={`supplier:${supplier.id}`}
        name={supplier.name}
        sequence={data.history?.sequence ?? 0}
        baseline={data.history?.baselineVersion ?? data.version}
      />
      <ContractFreshness fetchedAt={data.fetchedAt} refresh={data.refresh} />
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">
          O que mudou para este fornecedor
        </h2>
        <ContractEventList
          events={[...(data.history?.events ?? [])]
            .reverse()
            .filter((e) => eventMatches(e, `supplier:${supplier.id}`))
            .slice(0, 20)}
        />
        <Link
          href="/contratos/historico"
          className="inline-block py-3 text-sm text-emerald-300"
        >
          Ver histórico completo dos contratos →
        </Link>
        {!(data.history?.events ?? []).some((e) =>
          eventMatches(e, `supplier:${supplier.id}`),
        ) && (
          <p className="text-sm text-zinc-400">
            Nenhuma mudança observada desde a referência inicial.
          </p>
        )}
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          [String(contracts.length), "contratos no recorte"],
          [contractMoney(total), "soma dos valores iniciais"],
          [
            String(
              new Set(contracts.map((c) => c.sourceUrl.split("/")[5])).size,
            ),
            "órgãos contratantes",
          ],
        ].map(([v, l]) => (
          <div
            key={l}
            className="min-w-0 rounded-2xl border border-white/10 p-5"
          >
            <p className="break-words text-2xl font-semibold text-indigo-200">
              {v}
            </p>
            <p className="mt-2 text-xs text-zinc-400">{l}</p>
          </div>
        ))}
      </section>
      <nav
        aria-label="Navegar no fornecedor"
        className="flex flex-wrap gap-3 text-sm text-emerald-300"
      >
        <a
          className="rounded-xl border border-white/15 px-4 py-3"
          href="#contratos"
        >
          Ver contratos
        </a>
        <a
          className="rounded-xl border border-white/15 px-4 py-3"
          href="#conexoes"
        >
          Ver conexões
        </a>
        <a
          className="rounded-xl border border-white/15 px-4 py-3"
          href="#compartilhar"
        >
          Compartilhar
        </a>
      </nav>
      <SupplierGraph {...graph} />
      <section
        id="conexoes"
        className="scroll-mt-32 rounded-2xl border border-white/10 p-5 sm:p-6"
      >
        <h2 className="text-xl font-semibold">Conexões nos grafos de perfis</h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Correspondência pela raiz validada do CNPJ, sem associação por
          semelhança de nomes. Cada link abre a empresa no grafo original, onde
          os tipos e períodos das relações estão descritos. Contratar com um
          órgão não implica relação pessoal com seu governador.
        </p>
        {supplier.connections.length ? (
          <details className="mt-5" open={supplier.connections.length <= 6}>
            <summary className="cursor-pointer py-3 text-sm text-emerald-300">
              Ver {supplier.connections.length} perfis com correspondência
              documental
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {supplier.connections.map((c) => (
                <Link
                  key={`${c.profileId}-${c.nodeId}`}
                  href={contractProfilePath(c)}
                  className="min-w-0 rounded-xl border border-white/10 p-4 hover:border-emerald-300/30"
                >
                  <p className="text-sm font-medium text-emerald-200">
                    {c.profileName} →
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    {c.direct
                      ? "Vínculo direto documentado"
                      : "Aparece no entorno do perfil; sem vínculo direto"}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Relações da empresa no grafo:{" "}
                    {c.relationships.map((t) => RELATION_NAMES[t]).join(" · ")}
                  </p>
                </Link>
              ))}
            </div>
          </details>
        ) : (
          <p className="mt-5 rounded-xl bg-white/[0.03] p-4 text-sm text-zinc-400">
            Nenhuma correspondência documental encontrada no snapshot atual dos
            grafos. Isso não significa ausência de relações fora da cobertura.
          </p>
        )}
      </section>
      <section id="contratos" className="scroll-mt-32">
        <h2 className="mb-5 text-xl font-semibold">
          Contratos deste fornecedor
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {contracts.map((c) => (
            <Link
              key={c.id}
              href={`/contratos/${c.id}`}
              className="min-w-0 rounded-2xl border border-white/10 p-5 hover:border-emerald-300/30"
            >
              <p className="text-xs text-emerald-300">
                {c.uf} · Contrato {c.number}/{c.year}
              </p>
              <h3 className="mt-3 break-words text-sm leading-relaxed">
                {c.object.length > 200
                  ? c.object.slice(0, 200) + "…"
                  : c.object}
              </h3>
              <p className="mt-3 text-xs text-zinc-400">{c.agency}</p>
              <p className="mt-4 text-xl font-semibold">
                {contractMoney(c.initialValue)}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Valor inicial · Publicado em {contractDate(c.publishedAt)}
              </p>
            </Link>
          ))}
        </div>
      </section>
      <div id="compartilhar" className="scroll-mt-32">
        <ContractShare
          title={supplier.name}
          amount={contractMoney(total)}
          facts={[
            `${contracts.length} contrato${contracts.length === 1 ? "" : "s"} em ${ufs.join(" e ")}. Soma dos valores iniciais.`,
            `Publicações de ${contractPeriod(data.period)}. Não inclui todo o histórico da empresa.`,
            `Fornecedores agrupados por raiz de CNPJ. Consulta em ${contractDate(data.fetchedAt)}.`,
          ]}
          path={`/fornecedores/${supplier.id}`}
          version={data.version}
        />
      </div>
      <ContractCoverage data={data} />
    </div>
  );
}
