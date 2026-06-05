"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import NetworkGraph from "@/components/NetworkGraph";
import type { EgoNetwork, GraphNode } from "@/lib/contract";
import type { IndexEntry } from "@/lib/data";
import {
  CATEGORY_LABELS,
  CONNECTION_LABELS,
  getCategoryColor,
} from "@/lib/graph-colors";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const SOURCE_LABELS: Record<string, string> = {
  camara: "Câmara dos Deputados",
  tse: "TSE",
  receita: "Receita Federal",
  transparencia: "Portal da Transparência",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export default function EgoView({
  ego,
  entry,
}: {
  ego: EgoNetwork;
  entry: IndexEntry | null;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const sourceLabels = (ego.meta?.sources ?? []).map(sourceLabel);

  const nameById = useMemo(
    () => new Map(ego.nodes.map((n) => [n.id, n.name])),
    [ego.nodes],
  );
  const donorCount = ego.links.filter((l) => l.connectionType === "doacao").length;

  const selectedLinks = useMemo(() => {
    if (!selected) return [];
    return ego.links
      .filter((l) => l.source === selected.id || l.target === selected.id)
      .map((l) => {
        const otherId = l.source === selected.id ? l.target : l.source;
        return {
          id: l.id,
          other: nameById.get(otherId) ?? "?",
          type: l.connectionType,
          description: l.description,
        };
      });
  }, [selected, ego.links, nameById]);

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        <ArrowLeft size={15} /> todos os deputados
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-5">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-400/20 to-emerald-400/20 text-lg font-semibold text-indigo-200 ring-1 ring-white/10">
          {initials(ego.meta?.egoName ?? "?")}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {ego.meta?.egoName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            {entry?.party && (
              <span className="rounded-md bg-white/5 px-2 py-0.5 font-medium text-zinc-300 ring-1 ring-white/10">
                {entry.party}
              </span>
            )}
            {entry?.uf && <span className="text-zinc-400">{entry.uf}</span>}
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">
              {Math.max(0, ego.nodes.length - 1)} conexões · {donorCount} doadores
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(ego.meta?.sources ?? []).map((s) => (
            <span
              key={s}
              className="rounded-md bg-emerald-400/10 px-2 py-0.5 text-[11px] tracking-wide text-emerald-300 uppercase ring-1 ring-emerald-400/20"
            >
              {s}
            </span>
          ))}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        <NetworkGraph data={ego} searchQuery={query} onSelectNode={setSelected} />

        <aside className="space-y-4">
          <div className="relative">
            <Search
              size={15}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrar no grafo"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pr-3 pl-9 text-sm text-zinc-100 transition outline-none placeholder:text-zinc-500 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
            />
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            {selected ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: getCategoryColor(selected.category) }}
                  />
                  <span className="text-sm font-medium text-zinc-100">
                    {selected.name}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {CATEGORY_LABELS[selected.category]} · {selected.connectionCount}{" "}
                  conexões
                </p>
                <ul className="mt-3 space-y-2 border-t border-white/5 pt-3">
                  {selectedLinks.map((l) => (
                    <li key={l.id} className="text-xs leading-relaxed text-zinc-400">
                      <span className="font-medium text-zinc-300">
                        {CONNECTION_LABELS[l.type]}
                      </span>
                      {l.description ? <> · {l.description}</> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                Clique em um nó do grafo para ver os detalhes da conexão.
              </p>
            )}
          </div>

          <p className="px-1 text-xs leading-relaxed text-zinc-600">
            Conexões a partir de dados públicos
            {sourceLabels.length ? ` (${sourceLabels.join(", ")})` : ""}. Não
            representam acusação de irregularidade.
          </p>
        </aside>
      </div>
    </div>
  );
}
