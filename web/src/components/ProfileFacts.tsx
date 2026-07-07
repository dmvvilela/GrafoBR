import type { EgoNetwork } from "@/lib/contract";
import { isPartyDonor } from "@/lib/donors";

type Fact = {
  label: string;
  value: number;
  hint?: string;
};

function countLinks(ego: EgoNetwork, type: string): number {
  return ego.links.filter((link) => link.connectionType === type).length;
}

export default function ProfileFacts({
  ego,
  relatedCount,
  obrasSignals,
}: {
  ego: EgoNetwork;
  relatedCount: number;
  obrasSignals?: number;
}) {
  const donors = ego.nodes.filter((node) => node.category === "donor");
  const privateDonors = donors.filter((node) => !isPartyDonor(node.name)).length;
  const companies = ego.nodes.filter((node) => node.category === "company").length;
  const suppliers = ego.nodes.filter((node) => node.category === "supplier").length;
  const emendaAreas = ego.nodes.filter((node) => node.category === "destino").length;
  const contracts = countLinks(ego, "contrato");
  const facts: Fact[] = [
    {
      label: "doadores",
      value: donors.length,
      hint: privateDonors ? `${privateDonors} privados` : undefined,
    },
    { label: "empresas", value: companies },
    { label: "fornecedores CEAP", value: suppliers },
    { label: "contratos federais", value: contracts },
    { label: "áreas de emenda", value: emendaAreas },
    { label: "parlamentares em comum", value: relatedCount },
  ];
  if (obrasSignals != null) {
    facts.push({ label: "obras no estado", value: obrasSignals });
  }

  return (
    <section className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="min-w-0 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
        >
          <p className="text-lg font-semibold tabular-nums text-zinc-100">
            {fact.value.toLocaleString("pt-BR")}
          </p>
          <p className="truncate text-[11px] text-zinc-500" title={fact.label}>
            {fact.label}
          </p>
          {fact.hint ? (
            <p className="mt-0.5 truncate text-[10px] text-zinc-600" title={fact.hint}>
              {fact.hint}
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
