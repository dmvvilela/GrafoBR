import Link from "next/link";
import { EVENT_LABELS, FIELD_LABELS } from "@/lib/contract-history";
import { contractObservedAt, type ContractEvent } from "@/lib/state-contracts";
export default function ContractEventList({
  events,
}: {
  events: ContractEvent[];
}) {
  return (
    <div className="space-y-3">
      {events.map((e) => {
        const c = (e.after ?? e.before)!;
        return (
          <Link
            key={e.id}
            href={`/contratos/historico/${e.id}`}
            className="block min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-5 hover:border-emerald-300/40"
          >
            <p className="text-xs text-emerald-300">
              {c.uf} · {EVENT_LABELS[e.kind]} · observado em{" "}
              {contractObservedAt(e.observedAt)}
            </p>
            <h3 className="mt-3 break-words font-medium">
              Contrato {c.number}/{c.year} · {c.supplierName}
            </h3>
            <p className="mt-2 break-words text-sm text-zinc-400">
              {e.kind === "changed"
                ? e.fields.map((f) => FIELD_LABELS[f]).join(" · ")
                : c.agency}
            </p>
            <p className="mt-3 text-sm text-emerald-200">
              Ver registro, antes/depois e card →
            </p>
          </Link>
        );
      })}
    </div>
  );
}
