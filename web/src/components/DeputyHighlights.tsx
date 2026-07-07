// At-a-glance money facts for a parlamentar, computed straight from the ego graph
// (no AI, no extra data) so the page tells its story before you explore the nodes.
import type { EgoNetwork } from "@/lib/contract";
import { isPartyDonor } from "@/lib/donors";

function parseBRL(desc: string | null | undefined, kw?: string): number {
  if (!desc) return 0;
  const re = kw
    ? new RegExp(`R\\$\\s*([\\d.]+,\\d{2})\\s*${kw}`)
    : /R\$\s*([\d.]+,\d{2})/;
  const m = desc.match(re);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : 0;
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

interface Stat {
  label: string;
  value: number;
  hint?: string;
  color: string; // text color class
  ring: string; // border/bg tint
}

export default function DeputyHighlights({ ego }: { ego: EgoNetwork }) {
  const nameById = new Map(ego.nodes.map((n) => [n.id, n]));
  const other = (l: { source: number; target: number }) =>
    nameById.get(l.source)?.category === "politician"
      ? nameById.get(l.target)
      : nameById.get(l.source);

  let emendaEmp = 0;
  let emendaPago = 0;
  let topArea: { name: string; v: number } | null = null;
  let ceap = 0;
  let topSupplier: { name: string; v: number } | null = null;
  let donations = 0;
  let topDonor: { name: string; v: number } | null = null;
  let topContract: { name: string; v: number } | null = null;

  for (const l of ego.links) {
    const node = other(l);
    const name = node?.name ?? "";
    if (l.connectionType === "emenda") {
      const e = parseBRL(l.description, "empenhado");
      emendaEmp += e;
      emendaPago += parseBRL(l.description, "pago");
      if (!topArea || e > topArea.v) topArea = { name, v: e };
    } else if (l.connectionType === "despesa") {
      const v = parseBRL(l.description, ""); // "total de R$..."
      ceap += v;
      if (!topSupplier || v > topSupplier.v) topSupplier = { name, v };
    } else if (l.connectionType === "doacao") {
      const v = parseBRL(l.description);
      donations += v;
      if (node && !isPartyDonor(name) && (!topDonor || v > topDonor.v))
        topDonor = { name, v };
    } else if (l.connectionType === "contrato") {
      const v = parseBRL(l.description);
      if (!topContract || v > topContract.v) topContract = { name, v };
    }
  }

  const stats: Stat[] = [];
  if (emendaEmp > 0)
    stats.push({
      label: "em emendas individuais",
      value: emendaEmp,
      hint:
        (topArea ? `maior área: ${topArea.name}` : "") +
        (emendaPago > 0 ? ` · ${brl(emendaPago)} pago` : ""),
      color: "text-purple-300",
      ring: "border-purple-400/15 bg-purple-400/[0.03]",
    });
  if (topContract)
    stats.push({
      label: "em contratos federais",
      value: topContract.v,
      hint: `empresa: ${topContract.name}`,
      color: "text-amber-300",
      ring: "border-amber-400/15 bg-amber-400/[0.03]",
    });
  if (ceap > 0)
    stats.push({
      label: "em despesas de cota",
      value: ceap,
      hint: topSupplier ? `maior: ${topSupplier.name}` : undefined,
      color: "text-teal-300",
      ring: "border-teal-400/15 bg-teal-400/[0.03]",
    });
  if (donations > 0)
    stats.push({
      label: "em doações de campanha",
      value: donations,
      hint: topDonor ? `maior privado: ${topDonor.name}` : undefined,
      color: "text-yellow-300",
      ring: "border-yellow-400/15 bg-yellow-400/[0.03]",
    });

  if (stats.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className={`min-w-0 rounded-2xl border p-4 ${s.ring}`}>
          <p className={`truncate text-xl font-semibold tabular-nums ${s.color}`}>
            {brl(s.value)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{s.label}</p>
          {s.hint ? (
            <p className="mt-1.5 truncate text-xs text-zinc-500" title={s.hint}>
              {s.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
