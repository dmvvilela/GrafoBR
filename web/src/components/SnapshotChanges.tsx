import Link from "next/link";
import type { ChangeItem, ChangesIndex } from "@/lib/data";

function brl(value: number | null | undefined): string {
  if (typeof value !== "number" || value === 0) return "";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function ChangeRow({ item, mode }: { item: ChangeItem; mode: "added" | "removed" | "changed" }) {
  const label = mode === "added" ? "novo" : mode === "removed" ? "saiu" : "mudou";
  const style =
    mode === "added"
      ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
      : mode === "removed"
        ? "bg-zinc-400/10 text-zinc-400 ring-zinc-400/20"
        : "bg-sky-400/10 text-sky-300 ring-sky-400/20";

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
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${style}`}>
          {label}
        </span>
      </div>
      {mode === "changed" && item.delta ? (
        <p className="mt-2 text-xs tabular-nums text-zinc-500">
          {brl(item.previousValue)} → {brl(item.value)}{" "}
          <span className={item.delta > 0 ? "text-emerald-300" : "text-rose-300"}>
            ({item.delta > 0 ? "+" : ""}
            {brl(item.delta)})
          </span>
        </p>
      ) : item.value ? (
        <p className="mt-2 text-sm font-semibold tabular-nums text-zinc-200">
          {brl(item.value)}
        </p>
      ) : null}
    </Link>
  );
}

export default function SnapshotChanges({ changes }: { changes: ChangesIndex | null }) {
  if (!changes) return null;
  const items = [
    ...changes.added.slice(0, 3).map((item) => ({ item, mode: "added" as const })),
    ...changes.changed.slice(0, 3).map((item) => ({ item, mode: "changed" as const })),
    ...changes.removed.slice(0, 2).map((item) => ({ item, mode: "removed" as const })),
  ];

  if (!changes.hasPrevious) {
    return (
      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-zinc-100">Mudanças no snapshot</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">
          {changes.note} No próximo refresh, esta seção destacará novos sinais,
          mudanças de valor e itens que saíram do recorte.
        </p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-zinc-100">Mudanças no snapshot</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Nenhuma mudança nos principais sinais desde o snapshot anterior.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
          Mudanças no snapshot
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Comparação automática com a versão anterior de sinais — mudanças de
          recorte, não julgamento.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ item, mode }) => (
          <ChangeRow key={`${mode}-${item.kind}-${item.href}-${item.title}`} item={item} mode={mode} />
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-600">{changes.note}</p>
    </section>
  );
}
