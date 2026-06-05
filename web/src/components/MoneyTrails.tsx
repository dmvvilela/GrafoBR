import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { Highlight } from "@/lib/data";

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export default function MoneyTrails({ highlights }: { highlights: Highlight[] }) {
  if (highlights.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
          Rastros de dinheiro
        </h2>
        <p className="mx-auto mt-1 max-w-xl text-sm text-zinc-500">
          Deputados que são sócios de empresas com contratos federais. Conexões de
          registros públicos — investigue antes de concluir.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {highlights.map((h) => (
          <Link
            key={`${h.id}-${h.company}`}
            href={`/politico/${h.id}`}
            className="group rounded-2xl border border-amber-400/15 bg-amber-400/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-amber-400/40 hover:bg-amber-400/[0.06]"
          >
            <div className="flex items-center gap-3">
              <Avatar id={h.id} name={h.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{h.name}</p>
                <p className="text-xs text-zinc-500">
                  {h.party}
                  {h.uf ? ` · ${h.uf}` : ""}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-400">
              sócio de <span className="text-zinc-200">{h.company}</span>
            </p>
            <p className="mt-1.5 text-base font-semibold text-amber-300">
              {brl(h.value)}
            </p>
            <p className="truncate text-xs text-zinc-500">
              em contratos federais{h.org ? ` · ${h.org}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
