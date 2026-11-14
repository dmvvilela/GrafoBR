import Link from "next/link";
import {
  contractObservedAt,
  contractSourceDate,
  contractMoney,
  type StateContract,
  type ContractEvent,
} from "@/lib/state-contracts";
import { EVENT_LABELS, FIELD_LABELS } from "@/lib/contract-history";
import ChangeShare from "./ChangeShare";
function display(c: StateContract | null, field: keyof StateContract): string {
  if (!c) return "Ausente nesta consulta";
  const value = c[field];
  if (value === null) return "Não informado";
  if (field === "initialValue") return contractMoney(c.initialValue);
  if (field.endsWith("At")) return contractSourceDate(String(value));
  return String(value);
}
export default function ContractChangeView({
  event,
}: {
  event: ContractEvent;
}) {
  const c = (event.after ?? event.before)!;
  const fields =
    event.kind === "changed"
      ? event.fields
      : ([
          "initialValue",
          "supplierName",
          "object",
          "endsAt",
        ] as (keyof StateContract)[]);
  const short = (text: string) =>
    text.length > 300
      ? text.slice(0, 300) + "… (ver registro completo no link)"
      : text;
  const lines = [
    `${EVENT_LABELS[event.kind]} · ${c.supplierName}`,
    `Antes: consulta de ${contractObservedAt(event.previousObservedAt)}. Depois: consulta de ${contractObservedAt(event.observedAt)}.`,
    ...fields.map(
      (f) =>
        `${FIELD_LABELS[f]} — antes: ${short(display(event.before, f))} → depois: ${short(display(event.after, f))}`,
    ),
    `Órgão: ${c.agency}. Fonte: PNCP.`,
    `Versões observadas: ${event.fromVersion} → ${event.toVersion}.`,
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <Link
        href="/contratos/historico"
        className="inline-block py-3 text-sm text-emerald-300"
      >
        ← Histórico dos contratos
      </Link>
      <header>
        <p className="text-xs uppercase tracking-widest text-emerald-300">
          {c.uf} · {EVENT_LABELS[event.kind]}
        </p>
        <h1 className="mt-4 break-words text-3xl font-semibold">
          Contrato {c.number}/{c.year}
        </h1>
        <p className="mt-4 break-words text-zinc-400">
          {c.supplierName} · {c.agency}
        </p>
        <p className="mt-3 text-sm text-zinc-400">
          Observado entre as consultas de{" "}
          {contractObservedAt(event.previousObservedAt)} e{" "}
          {contractObservedAt(event.observedAt)}. Essas são datas de consulta,
          não necessariamente a data da mudança na fonte.
        </p>
      </header>
      <div className="space-y-4">
        {fields.map((f) => (
          <section key={f} className="rounded-2xl border border-white/10 p-5">
            <h2 className="font-medium text-emerald-200">{FIELD_LABELS[f]}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 rounded-xl bg-white/5 p-4">
                <p className="text-xs text-zinc-500">
                  ANTES · {contractObservedAt(event.previousObservedAt)}
                </p>
                <p className="mt-2 break-words text-sm">
                  {display(event.before, f)}
                </p>
              </div>
              <div className="min-w-0 rounded-xl bg-emerald-300/5 p-4">
                <p className="text-xs text-emerald-300">
                  DEPOIS · {contractObservedAt(event.observedAt)}
                </p>
                <p className="mt-2 break-words text-sm">
                  {display(event.after, f)}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-zinc-400">
        Uma alteração cadastral não comprova aditivo, pagamento ou
        irregularidade. Não retornar na consulta não significa cancelamento. O
        valor é o inicial informado; não é gasto realizado.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link href={`/contratos/${c.id}`} className="py-3 text-emerald-300">
          Histórico deste contrato →
        </Link>
        <a
          href={c.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="py-3 text-emerald-300"
        >
          Registro oficial no PNCP ↗
        </a>
      </div>
      <ChangeShare
        title={`Contrato ${c.number}/${c.year} · ${c.uf}`}
        lines={lines}
        path={`/contratos/historico/${event.id}`}
      />
    </div>
  );
}
