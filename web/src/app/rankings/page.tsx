import type { Metadata } from "next";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import {
  getCeapRanking,
  getContractRanking,
  getEmendaRanking,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "Rankings — GrafoBR",
  description:
    "Rankings de dinheiro público: maiores autores de emendas individuais, maiores destinos da cota parlamentar e empresas de deputados com contratos federais.",
};

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function Rank({ i }: { i: number }) {
  return (
    <span className="w-7 shrink-0 text-right text-xs font-medium text-zinc-600 tabular-nums">
      {i}
    </span>
  );
}

export default async function RankingsPage() {
  const [emendas, ceap, contracts] = await Promise.all([
    getEmendaRanking(),
    getCeapRanking(),
    getContractRanking(),
  ]);

  return (
    <div className="space-y-10">
      <header className="pt-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Rankings</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
          Fluxos de dinheiro público, ordenados. Conexões de registros oficiais —{" "}
          <span className="text-zinc-500">investigue antes de concluir</span>.
        </p>
      </header>

      {/* Emendas */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-purple-300">
            Emendas individuais
          </h2>
          <span className="text-xs text-zinc-500">{emendas.length} deputados · 2023–2025</span>
        </div>
        <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
          {emendas.map((e, i) => (
            <li key={e.id}>
              <Link
                href={`/politico/${e.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/[0.03]"
              >
                <Rank i={i + 1} />
                <Avatar id={e.id} name={e.name} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-100">{e.name}</span>
                  <span className="text-xs text-zinc-500">
                    {e.party}
                    {e.uf ? ` · ${e.uf}` : ""}
                    {e.topArea ? ` · ${e.topArea}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold text-purple-300 tabular-nums">
                    {brl(e.empenhado)}
                  </span>
                  <span className="text-xs text-zinc-600 tabular-nums">
                    {brl(e.pago)} pago
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* CEAP */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-teal-300">
            Destinos da cota parlamentar (CEAP)
          </h2>
          <span className="text-xs text-zinc-500">fornecedores · 2025</span>
        </div>
        <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
          {ceap.map((c, i) => (
            <li key={c.supplier} className="flex items-center gap-3 px-3 py-2.5">
              <Rank i={i + 1} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-100" title={c.supplier}>
                  {c.supplier}
                </span>
                <span className="text-xs text-zinc-500">
                  {c.category} · {c.deputies} deputados
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-teal-300 tabular-nums">
                {brl(c.total)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Contratos */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-amber-300">
            Empresas de deputados com contratos federais
          </h2>
          <span className="text-xs text-zinc-500">{contracts.length} leads verificados</span>
        </div>
        <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
          {contracts.map((h, i) => (
            <li key={`${h.id}-${h.company}`}>
              <Link
                href={`/politico/${h.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/[0.03]"
              >
                <Rank i={i + 1} />
                <Avatar id={h.id} name={h.name} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-100">{h.name}</span>
                  <span className="truncate text-xs text-zinc-500">
                    sócio de {h.company}
                    {h.org ? ` · ${h.org}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-amber-300 tabular-nums">
                  {brl(h.value)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
