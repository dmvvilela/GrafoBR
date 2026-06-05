"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import NetworkGraph from "@/components/NetworkGraph";
import Avatar from "@/components/Avatar";
import type { EgoNetwork, GraphNode } from "@/lib/contract";
import type { IndexEntry } from "@/lib/data";
import {
  CATEGORY_LABELS,
  CONNECTION_LABELS,
  getCategoryColor,
} from "@/lib/graph-colors";
import { isPartyDonor, normalizeDonorName } from "@/lib/donors";

const SOURCE_LABELS: Record<string, string> = {
  camara: "Câmara dos Deputados",
  camara_ceap: "Câmara dos Deputados — CEAP",
  cgu_emendas: "CGU — Emendas Parlamentares",
  tse: "TSE",
  receita: "Receita Federal",
  transparencia: "Portal da Transparência",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

type SharedMap = Record<
  string,
  { name: string; deputies: { id: number; name: string }[] }
>;

export default function EgoView({
  ego,
  entry,
}: {
  ego: EgoNetwork;
  entry: IndexEntry | null;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [shared, setShared] = useState<SharedMap>({});
  const sourceLabels = (ego.meta?.sources ?? []).map(sourceLabel);

  useEffect(() => {
    fetch("/data/_shared-donors.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setShared)
      .catch(() => {});
  }, []);

  const nameById = useMemo(
    () => new Map(ego.nodes.map((n) => [n.id, n.name])),
    [ego.nodes],
  );

  const donors = ego.nodes.filter((n) => n.category === "donor");
  const partyDonors = donors.filter((n) => isPartyDonor(n.name)).length;
  const privateDonors = donors.length - partyDonors;

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

  const selectedAlsoFunded = useMemo(() => {
    if (!selected || selected.category !== "donor") return [];
    const e = shared[normalizeDonorName(selected.name)];
    if (!e) return [];
    return e.deputies.filter((d) => d.id !== ego.meta?.egoId);
  }, [selected, shared, ego.meta?.egoId]);

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        <ArrowLeft size={15} /> todos os deputados
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-5">
        <Avatar id={ego.meta?.egoId ?? entry?.id ?? 0} name={ego.meta?.egoName ?? "?"} size={64} />
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
              <span className="text-amber-300">{privateDonors}</span>{" "}
              {privateDonors === 1 ? "doador privado" : "doadores privados"} ·{" "}
              {partyDonors} de partidos
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
        <NetworkGraph
          data={ego}
          searchQuery={query}
          focusId={selected?.id ?? null}
          onSelectNode={setSelected}
        />

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

                {selected.category === "donor" && (
                  <span
                    className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[11px] ring-1 ${
                      isPartyDonor(selected.name)
                        ? "bg-white/5 text-zinc-400 ring-white/10"
                        : "bg-amber-400/10 text-amber-300 ring-amber-400/20"
                    }`}
                  >
                    {isPartyDonor(selected.name)
                      ? "Comitê de partido"
                      : "Doador privado"}
                  </span>
                )}

                <ul className="mt-3 space-y-2 border-t border-white/5 pt-3">
                  {selectedLinks.map((l) => (
                    <li
                      key={l.id}
                      className="text-xs leading-relaxed text-zinc-400"
                    >
                      <span className="font-medium text-zinc-300">
                        {CONNECTION_LABELS[l.type]}
                      </span>
                      {l.description ? <> · {l.description}</> : null}
                    </li>
                  ))}
                </ul>

                {selectedAlsoFunded.length > 0 && (
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <p className="text-xs text-zinc-500">
                      Também doou para {selectedAlsoFunded.length}{" "}
                      {selectedAlsoFunded.length === 1
                        ? "outro deputado"
                        : "outros deputados"}
                      :
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {selectedAlsoFunded.map((d) => (
                        <li key={d.id}>
                          <Link
                            href={`/politico/${d.id}`}
                            className="text-xs text-emerald-300 hover:underline"
                          >
                            {d.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
