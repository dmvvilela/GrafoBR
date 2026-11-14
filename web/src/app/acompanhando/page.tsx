import { getStateContracts } from "@/lib/data";
import { allKnownSuppliers } from "@/lib/contract-history";
import FollowingDashboard from "@/components/FollowingDashboard";
import ContractFreshness from "@/components/ContractFreshness";
export const metadata = {
  title: "Acompanhando — GrafoBR",
  robots: { index: false, follow: true },
};
export default async function Page() {
  const data = await getStateContracts();
  if (!data) return <p>Aguardando dados validados.</p>;
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header>
        <p className="text-xs tracking-widest text-emerald-300">
          SEUS ESTADOS · SEUS FORNECEDORES
        </p>
        <h1 className="mt-4 text-3xl font-semibold sm:text-5xl">
          Acompanhando
        </h1>
        <p className="mt-4 leading-relaxed text-zinc-400">
          Escolha quem acompanhar e veja o que mudou nos contratos do PNCP
          quando voltar. Cada mudança traz o registro oficial, as versões
          observadas e um card para compartilhar.
        </p>
      </header>
      <ContractFreshness fetchedAt={data.fetchedAt} refresh={data.refresh} />
      <FollowingDashboard
        history={
          data.history ?? {
            schemaVersion: 1,
            baselineAt: data.fetchedAt,
            baselineVersion: data.version,
            sequence: 0,
            events: [],
          }
        }
        suppliers={allKnownSuppliers(data).map((s) => ({
          id: s.id,
          name: s.name,
        }))}
      />
    </div>
  );
}
