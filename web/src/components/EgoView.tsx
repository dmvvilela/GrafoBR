"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import NetworkGraph from "@/components/NetworkGraph";
import DeputyHighlights from "@/components/DeputyHighlights";
import Avatar from "@/components/Avatar";
import type { EgoNetwork, GraphNode } from "@/lib/contract";
import type { IndexEntry } from "@/lib/data";
import {
  CATEGORY_LABELS,
  CONNECTION_LABELS,
  getCategoryColor,
} from "@/lib/graph-colors";
import { isPartyDonor } from "@/lib/donors";

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

const CROSS_VERB: Record<string, (n: number) => string> = {
  donor: (n) => `Também doou para ${n} ${n === 1 ? "outro deputado" : "outros deputados"}`,
  supplier: (n) => `Também pago por ${n} ${n === 1 ? "outro deputado" : "outros deputados"}`,
  company: (n) => `${n} ${n === 1 ? "outro deputado ligado" : "outros deputados ligados"}`,
};

const SOURCE_LABELS: Record<string, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
  camara_ceap: "Câmara dos Deputados — CEAP",
  cgu_emendas: "CGU — Emendas Parlamentares",
  tse: "TSE",
  receita: "Receita Federal",
  transparencia: "Portal da Transparência",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

type EntityDeputy = {
  id: number;
  name: string;
  party?: string | null;
  uf?: string | null;
  amount: number;
};
type EntityMap = Record<
  string,
  { name: string; category: string; count: number; deputies: EntityDeputy[] }
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
  const [entities, setEntities] = useState<EntityMap>({});
  const sourceLabels = (ego.meta?.sources ?? []).map(sourceLabel);

  useEffect(() => {
    fetch("/data/_entities.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setEntities)
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

  const selectedEntity = useMemo(() => {
    if (!selected) return null;
    const e = entities[selected.name];
    if (!e) return null;
    const others = e.deputies.filter((d) => d.id !== ego.meta?.egoId);
    if (others.length === 0) return null;
    // e.count includes this deputy; the rest is the cross-link headline
    return { category: e.category, total: e.count - 1, others };
  }, [selected, entities, ego.meta?.egoId]);

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        <ArrowLeft size={15} /> todos os parlamentares
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
              {ego.meta?.chamber === "senado" ? "Senador(a)" : "Deputado(a) federal"}
            </span>
            {donors.length > 0 && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">
                  <span className="text-amber-300">{privateDonors}</span>{" "}
                  {privateDonors === 1 ? "doador privado" : "doadores privados"} ·{" "}
                  {partyDonors} de partidos
                </span>
              </>
            )}
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

      {ego.meta?.summary ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-sm leading-relaxed text-zinc-300">{ego.meta.summary}</p>
          <p className="mt-2 text-[11px] text-zinc-600">
            Resumo gerado por IA local a partir dos registros públicos abaixo —
            conexões, não acusações.
          </p>
        </div>
      ) : null}

      <DeputyHighlights ego={ego} />

      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        {ego.links.length === 0 ? (
          <div className="grid h-[560px] place-items-center rounded-2xl border border-white/5 bg-white/[0.03] p-8 text-center">
            <div className="max-w-sm space-y-2">
              <p className="text-sm font-medium text-zinc-300">
                Sem conexões atribuídas nesta base.
              </p>
              <p className="text-xs leading-relaxed text-zinc-500">
                Não identificamos emendas individuais (2023+) para este parlamentar
                nos dados da CGU. A base aberta do Senado não publica CPF, então não
                cruzamos sócios e contratos para senadores.
              </p>
            </div>
          </div>
        ) : (
          <NetworkGraph
            data={ego}
            searchQuery={query}
            focusId={selected?.id ?? null}
            onSelectNode={setSelected}
          />
        )}

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

                {selectedEntity && (
                  <div className="mt-3 border-t border-white/5 pt-3">
                    <p className="text-xs font-medium text-zinc-400">
                      {(CROSS_VERB[selectedEntity.category] ?? CROSS_VERB.company)(
                        selectedEntity.total,
                      )}
                    </p>
                    <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto pr-1">
                      {selectedEntity.others.slice(0, 12).map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <Link
                            href={`/politico/${d.id}`}
                            className="truncate text-xs text-emerald-300 hover:underline"
                          >
                            {d.name}
                            {d.party ? (
                              <span className="text-zinc-600"> · {d.party}</span>
                            ) : null}
                          </Link>
                          {d.amount > 0 && (
                            <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
                              {brl(d.amount)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {selectedEntity.total > 12 && (
                      <p className="mt-1.5 text-xs text-zinc-600">
                        + {selectedEntity.total - 12} outros
                      </p>
                    )}
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
