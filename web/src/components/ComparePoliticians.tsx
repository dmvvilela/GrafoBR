"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ConnectionType, EgoNetwork, GraphNode } from "@/lib/contract";
import type { IndexEntry } from "@/lib/data";
import { CONNECTION_LABELS } from "@/lib/graph-colors";
import { sourceBadges } from "@/lib/evidence";

const TYPES: ConnectionType[] = ["doacao", "despesa", "socio", "contrato", "emenda"];

function countByType(ego: EgoNetwork | null) {
  const totals = new Map<ConnectionType, number>();
  for (const link of ego?.links ?? []) {
    totals.set(link.connectionType, (totals.get(link.connectionType) ?? 0) + 1);
  }
  return totals;
}

function byCategory(ego: EgoNetwork | null) {
  const totals = new Map<GraphNode["category"], number>();
  for (const node of ego?.nodes ?? []) {
    if (node.category === "politician") continue;
    totals.set(node.category, (totals.get(node.category) ?? 0) + 1);
  }
  return totals;
}

function sharedNodes(a: EgoNetwork | null, b: EgoNetwork | null) {
  if (!a || !b) return [];
  const left = new Map(
    a.nodes
      .filter((node) => node.category !== "politician")
      .map((node) => [node.name.toLocaleLowerCase("pt-BR"), node]),
  );
  return b.nodes
    .filter((node) => node.category !== "politician")
    .map((node) => left.get(node.name.toLocaleLowerCase("pt-BR")) ?? null)
    .filter(Boolean)
    .slice(0, 12) as GraphNode[];
}

function useEgo(id: string) {
  const [ego, setEgo] = useState<EgoNetwork | null>(null);
  useEffect(() => {
    if (!id) {
      setEgo(null);
      return;
    }
    fetch(`/data/${id}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setEgo)
      .catch(() => setEgo(null));
  }, [id]);
  return ego;
}

function Selector({
  label,
  value,
  entries,
  onChange,
}: {
  label: string;
  value: string;
  entries: IndexEntry[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
      >
        {entries.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name} {entry.party ? `· ${entry.party}` : ""} {entry.uf ? `· ${entry.uf}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({
  entry,
  ego,
}: {
  entry?: IndexEntry;
  ego: EgoNetwork | null;
}) {
  const categoryTotals = byCategory(ego);
  const badges = sourceBadges(entry?.sources ?? []);
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={entry ? `/politico/${entry.id}` : "#"}
            className="text-base font-medium text-zinc-100 hover:text-emerald-300"
          >
            {entry?.name ?? "Selecione"}
          </Link>
          <p className="mt-1 text-xs text-zinc-500">
            {entry?.party ?? "—"} {entry?.uf ? `· ${entry.uf}` : ""}
          </p>
        </div>
        <span className="rounded-lg bg-white/5 px-2 py-1 text-xs text-zinc-400 ring-1 ring-white/10">
          {ego?.links.length ?? 0} vínculos
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {badges.map((badge) => (
          <span key={badge} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500 ring-1 ring-white/10">
            {badge}
          </span>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {[
          ["Doadores", categoryTotals.get("donor") ?? 0],
          ["Fornecedores", categoryTotals.get("supplier") ?? 0],
          ["Empresas", categoryTotals.get("company") ?? 0],
          ["Destinos", categoryTotals.get("destino") ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/[0.03] p-3">
            <dt className="text-zinc-600">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-200">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function ComparePoliticians({ entries }: { entries: IndexEntry[] }) {
  const [a, setA] = useState(() => entries[0] ? String(entries[0].id) : "");
  const [b, setB] = useState(() => entries[1] ? String(entries[1].id) : "");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialA = params.get("a");
    const initialB = params.get("b");
    if (initialA && entries.some((entry) => String(entry.id) === initialA)) setA(initialA);
    if (initialB && entries.some((entry) => String(entry.id) === initialB)) setB(initialB);
  }, [entries]);

  useEffect(() => {
    if (!a || !b) return;
    const params = new URLSearchParams({ a, b });
    window.history.replaceState(null, "", `/comparar?${params.toString()}`);
  }, [a, b]);

  const egoA = useEgo(a);
  const egoB = useEgo(b);
  const entryA = entries.find((entry) => String(entry.id) === a);
  const entryB = entries.find((entry) => String(entry.id) === b);
  const typeA = useMemo(() => countByType(egoA), [egoA]);
  const typeB = useMemo(() => countByType(egoB), [egoB]);
  const shared = useMemo(() => sharedNodes(egoA, egoB), [egoA, egoB]);

  return (
    <div className="space-y-7">
      <div className="grid gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 md:grid-cols-2">
        <Selector label="Parlamentar A" value={a} entries={entries} onChange={setA} />
        <Selector label="Parlamentar B" value={b} entries={entries} onChange={setB} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard entry={entryA} ego={egoA} />
        <SummaryCard entry={entryB} ego={egoB} />
      </div>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-zinc-100">Vínculos por tipo</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-zinc-600">
              <tr>
                <th className="py-2 font-medium">Tipo</th>
                <th className="py-2 text-right font-medium">{entryA?.name ?? "A"}</th>
                <th className="py-2 text-right font-medium">{entryB?.name ?? "B"}</th>
                <th className="py-2 text-right font-medium">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {TYPES.map((type) => {
                const left = typeA.get(type) ?? 0;
                const right = typeB.get(type) ?? 0;
                return (
                  <tr key={type}>
                    <td className="py-2 text-zinc-300">{CONNECTION_LABELS[type]}</td>
                    <td className="py-2 text-right tabular-nums text-zinc-400">{left}</td>
                    <td className="py-2 text-right tabular-nums text-zinc-400">{right}</td>
                    <td className="py-2 text-right tabular-nums text-zinc-500">{left - right}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-zinc-100">Nós em comum</h2>
        {shared.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {shared.map((node) => (
              <span key={node.id} className="rounded-lg bg-white/[0.03] px-2 py-1 text-xs text-zinc-400 ring-1 ring-white/10">
                {node.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Nenhum doador, fornecedor, empresa ou destino de emenda em comum nos dois arquivos carregados.
          </p>
        )}
      </section>
    </div>
  );
}
