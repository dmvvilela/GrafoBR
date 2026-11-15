import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStateSpending, getStateContracts } from "@/lib/data";
import {
  DASHBOARD_STATES,
  isDashboardSlug,
  summarizeStateContracts,
} from "@/lib/state-dashboard";
import StateDashboard from "@/components/StateDashboard";
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(DASHBOARD_STATES).map((uf) => ({ uf }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ uf: string }>;
}): Promise<Metadata> {
  const { uf } = await params;
  return {
    title: isDashboardSlug(uf)
      ? `${DASHBOARD_STATES[uf]} — Meu estado — GrafoBR`
      : "Meu estado — GrafoBR",
    description:
      "Gastos em saúde, educação e segurança, fornecedores e contratos publicados: conheça seu estado com dados oficiais e períodos explícitos.",
    alternates: { canonical: `/meu-estado/${uf}` },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ uf: string }>;
}) {
  const { uf } = await params;
  if (!isDashboardSlug(uf)) notFound();
  const [spending, contracts] = await Promise.all([
    getStateSpending(),
    getStateContracts(),
  ]);
  if (!spending)
    return (
      <p className="p-8">
        As contas anuais deste painel aguardam uma importação validada.{" "}
        <a className="underline" href="/contratos">
          Explorar contratos
        </a>
      </p>
    );
  // Only the two comparison states and a bounded summary cross the client boundary.
  const scoped = {
    ...spending,
    states: spending.states.filter(
      (s) => s.uf === uf.toUpperCase() || s.uf === (uf === "sp" ? "MG" : "SP"),
    ),
  };
  return (
    <StateDashboard
      slug={uf}
      spending={scoped}
      contracts={
        contracts ? summarizeStateContracts(contracts, uf.toUpperCase()) : null
      }
    />
  );
}
