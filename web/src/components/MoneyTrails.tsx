import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { CeapTrail, EmendaTrail, Highlight } from "@/lib/data";

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function EmendaTrails({ trails }: { trails: EmendaTrail[] }) {
  if (trails.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-center text-xs font-medium tracking-wide text-zinc-400 uppercase">
        Maiores autores de emendas individuais
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trails.map((t) => (
          <Link
            key={t.id}
            href={`/politico/${t.id}`}
            className="group rounded-2xl border border-purple-400/15 bg-purple-400/[0.03] p-4 transition hover:-translate-y-0.5 hover:border-purple-400/40 hover:bg-purple-400/[0.06]"
          >
            <div className="flex items-center gap-3">
              <Avatar id={t.id} name={t.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-100">{t.name}</p>
                <p className="text-xs text-zinc-500">
                  {t.party}
                  {t.uf ? ` · ${t.uf}` : ""}
                </p>
              </div>
            </div>
            <p className="mt-3 text-base font-semibold text-purple-300">{brl(t.empenhado)}</p>
            <p className="text-xs text-zinc-500">
              empenhado em emendas individuais{t.topArea ? ` · maior área: ${t.topArea}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ContractTrails({ highlights }: { highlights: Highlight[] }) {
  if (highlights.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-center text-xs font-medium tracking-wide text-zinc-400 uppercase">
        Empresas de deputados com contratos federais
      </h3>
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
            <p className="mt-1.5 text-base font-semibold text-amber-300">{brl(h.value)}</p>
            <p className="truncate text-xs text-zinc-500">
              em contratos federais{h.org ? ` · ${h.org}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CeapTrails({ trails }: { trails: CeapTrail[] }) {
  if (trails.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-center text-xs font-medium tracking-wide text-zinc-400 uppercase">
        Maiores destinos da cota parlamentar (CEAP)
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trails.map((t) => (
          <div
            key={t.supplier}
            className="rounded-2xl border border-teal-400/15 bg-teal-400/[0.03] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded bg-teal-400/10 px-1.5 py-0.5 text-[11px] font-medium text-teal-300 ring-1 ring-teal-400/20">
                {t.category}
              </span>
              <span className="text-xs text-zinc-500">{t.deputies} deputados</span>
            </div>
            <p className="mt-3 truncate text-sm font-medium text-zinc-100" title={t.supplier}>
              {t.supplier}
            </p>
            <p className="mt-1.5 text-base font-semibold text-teal-300">{brl(t.total)}</p>
            <p className="text-xs text-zinc-500">em despesas de cota</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MoneyTrails({
  highlights,
  ceapTrails,
  emendaTrails,
}: {
  highlights: Highlight[];
  ceapTrails: CeapTrail[];
  emendaTrails: EmendaTrail[];
}) {
  if (highlights.length === 0 && ceapTrails.length === 0 && emendaTrails.length === 0)
    return null;
  return (
    <section className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
          Rastros de dinheiro
        </h2>
        <p className="mx-auto mt-1 max-w-xl text-sm text-zinc-500">
          Fluxos de dinheiro público em registros oficiais — investigue antes de concluir.
        </p>
      </div>

      <EmendaTrails trails={emendaTrails} />
      <ContractTrails highlights={highlights} />
      <CeapTrails trails={ceapTrails} />
    </section>
  );
}
