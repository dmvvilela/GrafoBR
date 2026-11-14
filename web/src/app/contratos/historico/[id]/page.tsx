import { notFound } from "next/navigation";
import { getStateContracts } from "@/lib/data";
import ContractChangeView from "@/components/ContractChangeView";
export const dynamicParams = false;
export async function generateStaticParams() {
  return (
    (await getStateContracts())?.history?.events.map((e) => ({ id: e.id })) ??
    []
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return {
    title: "Mudança observada no PNCP — GrafoBR",
    alternates: { canonical: `/contratos/historico/${id}` },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getStateContracts();
  const event = data?.history?.events.find((e) => e.id === id);
  if (!event) notFound();
  return <ContractChangeView event={event} />;
}
