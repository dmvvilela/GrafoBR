import Link from "next/link";
import type { Metadata } from "next";
import { DASHBOARD_STATES } from "@/lib/state-dashboard";
export const metadata: Metadata = {
  title: "Meu estado — GrafoBR",
  description:
    "Escolha São Paulo ou Minas Gerais para explorar gastos anuais, fornecedores e contratos com fontes oficiais.",
  alternates: { canonical: "/meu-estado" },
};
export default function Page() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-5 sm:py-12">
      <header>
        <p className="text-xs uppercase tracking-widest text-emerald-300">
          MEU ESTADO
        </p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">
          Comece pelo lugar onde você vive.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400">
          Entenda as prioridades do gasto, conheça os fornecedores e siga os
          documentos. Escolha seu estado para começar.
        </p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2">
        {Object.entries(DASHBOARD_STATES).map(([slug, name]) => (
          <Link
            key={slug}
            href={`/meu-estado/${slug}`}
            className="group rounded-3xl border border-white/15 bg-gradient-to-br from-emerald-400/10 to-indigo-400/5 p-7 transition hover:border-emerald-300/60"
          >
            <span className="text-5xl font-semibold text-emerald-300">
              {slug.toUpperCase()}
            </span>
            <h2 className="mt-6 text-2xl font-semibold">{name}</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Saúde, educação, segurança, fornecedores e publicações recentes de
              contratos.
            </p>
            <span className="mt-6 inline-block text-sm text-emerald-300">
              Explorar meu estado →
            </span>
          </Link>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-zinc-400">
        Painéis disponíveis para SP e MG. A{" "}
        <Link href="/estados" className="text-emerald-300 underline">
          comparação de contas anuais
        </Link>{" "}
        abrange todas as unidades da federação. Cada fonte mantém seu próprio
        período de cobertura.
      </p>
    </div>
  );
}
