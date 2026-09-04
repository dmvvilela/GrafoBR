import type { Metadata } from "next";
import UpdatesFeed from "@/components/UpdatesFeed";
import { getUpdates } from "@/lib/data";

export const metadata: Metadata = {
  title: "Atualizações dos dados — GrafoBR",
  description:
    "Acompanhe mudanças observadas em vínculos, candidaturas e obras entre versões dos dados públicos.",
};
export default async function UpdatesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="text-xs uppercase tracking-widest text-emerald-300">
          Histórico público
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Atualizações dos dados</h1>
      </header>
      <UpdatesFeed history={await getUpdates()} />
    </div>
  );
}
