import Link from "next/link";
import type { SignalsIndex, SignalItem } from "@/lib/data";

function brl(value: number | null | undefined): string {
  if (typeof value !== "number" || value <= 0) return "";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

const LABELS: Record<SignalItem["kind"], string> = {
  contract: "Contrato",
  emenda: "Emenda",
  obra: "Obra",
  ceap: "CEAP",
};

const STYLES: Record<SignalItem["kind"], string> = {
  contract: "text-amber-300 bg-amber-400/10 ring-amber-400/20",
  emenda: "text-purple-300 bg-purple-400/10 ring-purple-400/20",
  obra: "text-rose-300 bg-rose-400/10 ring-rose-400/20",
  ceap: "text-teal-300 bg-teal-400/10 ring-teal-400/20",
};

function SignalRow({ item }: { item: SignalItem }) {
  return (
    <Link
      href={item.href}
      className="block min-w-0 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-emerald-400/25 hover:bg-white/[0.04]"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-zinc-100">
            {item.title}
          </span>
          {item.context ? (
            <span className="mt-0.5 block truncate text-xs text-zinc-500">
              {item.context}
            </span>
          ) : null}
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${STYLES[item.kind]}`}
        >
          {LABELS[item.kind]}
        </span>
      </div>
      {item.value ? (
        <p className="mt-2 text-sm font-semibold tabular-nums text-zinc-200">
          {brl(item.value)}
        </p>
      ) : null}
    </Link>
  );
}

export default function SnapshotSignals({ signals }: { signals: SignalsIndex | null }) {
  if (!signals) return null;
  const items = [
    ...signals.topContracts.slice(0, 2),
    ...signals.topEmendas.slice(0, 2),
    ...signals.topObras.slice(0, 2),
    ...signals.topCeap.slice(0, 2),
  ];
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
            Sinais do snapshot
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Leituras automáticas do retrato atual dos dados — pistas, não acusações.
          </p>
        </div>
        <Link href="/dados" className="text-xs text-emerald-300 hover:underline">
          ver qualidade dos dados
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <SignalRow key={`${item.kind}-${item.href}-${item.title}`} item={item} />
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-600">{signals.note}</p>
    </section>
  );
}
