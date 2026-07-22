"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import { ArrowUpRight, ChevronDown, Search } from "lucide-react";
import type { IndexEntry } from "@/lib/data";
import Avatar from "@/components/Avatar";
import { CATEGORY_LABELS, getCategoryColor } from "@/lib/graph-colors";
import type { NodeCategory } from "@/lib/contract";
import { sourceBadges } from "@/lib/evidence";
import ExportButton from "@/components/ExportButton";

type EntityDeputy = {
  id: number;
  name: string;
  party?: string | null;
  uf?: string | null;
  amount: number;
};
type Entity = {
  id: string;
  name: string;
  category: NodeCategory;
  count: number;
  deputies: EntityDeputy[];
};
type EntityMap = Record<string, Entity>;

type Row =
  | {
      kind: "deputy";
      id: number;
      name: string;
      party?: string | null;
      uf?: string | null;
      sources: string[];
    }
  | ({ kind: "entity" } & Entity);

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function CategoryBadge({ category }: { category: NodeCategory }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] ring-1 ring-white/10">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: getCategoryColor(category) }}
      />
      <span className="text-zinc-400">{CATEGORY_LABELS[category]}</span>
    </span>
  );
}

function EntityRow({ entity }: { entity: Entity }) {
  const [open, setOpen] = useState(false);
  const shown = entity.deputies.slice(0, 12);
  const extra = entity.count - shown.length;
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-100">
            {entity.name}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <CategoryBadge category={entity.category} />
            <span className="text-xs text-zinc-500">
              {entity.count} deputados
            </span>
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul className="space-y-1 border-t border-white/5 px-4 py-3">
          {shown.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <Link
                href={`/politico/${d.id}`}
                className="truncate text-xs text-emerald-300 hover:underline"
              >
                {d.name}
                {d.party ? <span className="text-zinc-600"> · {d.party}</span> : null}
              </Link>
              {d.amount > 0 && (
                <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
                  {brl(d.amount)}
                </span>
              )}
            </li>
          ))}
          {extra > 0 && (
            <li className="text-xs text-zinc-600">+ {extra} outros deputados</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function SearchAll({ index }: { index: IndexEntry[] }) {
  const [query, setQuery] = useState("");
  const [entities, setEntities] = useState<EntityMap>({});

  useEffect(() => {
    fetch("/data/_entities.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setEntities)
      .catch(() => {});
  }, []);

  const rows = useMemo<Row[]>(() => {
    const deputies: Row[] = index.map((e) => ({
      kind: "deputy",
      id: e.id,
      name: e.name,
      party: e.party,
      uf: e.uf,
      sources: e.sources,
    }));
    const ents: Row[] = Object.values(entities).map((e) => ({ kind: "entity", ...e }));
    return [...deputies, ...ents];
  }, [index, entities]);

  const fuse = useMemo(
    () => new Fuse(rows, { keys: ["name", "party", "uf"], threshold: 0.32 }),
    [rows],
  );

  const q = query.trim();
  const results = q ? fuse.search(q).map((r) => r.item).slice(0, 40) : [];
  const deputyResults = results.filter((r): r is Extract<Row, { kind: "deputy" }> => r.kind === "deputy");
  const entityResults = results.filter((r): r is Extract<Row, { kind: "entity" }> => r.kind === "entity");

  // suggestions when idle: most-connected entities
  const suggestions = useMemo(
    () => Object.values(entities).sort((a, b) => b.count - a.count).slice(0, 8),
    [entities],
  );

  return (
    <div className="space-y-6">
      <div className="relative mx-auto max-w-xl">
        <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar deputado, empresa, fornecedor ou doador"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pr-4 pl-11 text-sm text-zinc-100 shadow-sm transition outline-none placeholder:text-zinc-500 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
        />
      </div>

      {!q ? (
        <div className="space-y-3">
          <p className="text-center text-xs text-zinc-500">
            Comece por uma empresa, fornecedor ou doador ligado a vários deputados:
          </p>
          <div className="space-y-2">
            {suggestions.map((e) => (
              <EntityRow key={e.id} entity={e} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">
              {results.length} resultados para “{query}”
            </p>
            <ExportButton
              filename="busca-grafobr.csv"
              rows={results.map((result) =>
                result.kind === "deputy"
                  ? {
                      tipo: "parlamentar",
                      id: result.id,
                      nome: result.name,
                      partido: result.party,
                      uf: result.uf,
                      fontes: result.sources.join("|"),
                    }
                  : {
                      tipo: result.category,
                      nome: result.name,
                      deputados: result.count,
                    },
              )}
              label="CSV"
            />
          </div>
          {entityResults.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                Empresas, fornecedores e doadores
              </h2>
              <div className="space-y-2">
                {entityResults.map((e) => (
                  <EntityRow key={e.id} entity={e} />
                ))}
              </div>
            </section>
          )}

          {deputyResults.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                Deputados
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {deputyResults.map((d) => (
                  <Link
                    key={d.id}
                    href={`/politico/${d.id}`}
                    className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 transition hover:border-emerald-400/30 hover:bg-white/[0.05]"
                  >
                    <Avatar id={d.id} name={d.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-100">{d.name}</span>
                      <span className="text-xs text-zinc-500">
                        {d.party}
                        {d.uf ? ` · ${d.uf}` : ""}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {sourceBadges(d.sources)
                          .slice(0, 4)
                          .map((badge) => (
                            <span
                              key={badge}
                              className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500 ring-1 ring-white/10"
                            >
                              {badge}
                            </span>
                          ))}
                      </span>
                    </span>
                    <ArrowUpRight size={15} className="shrink-0 text-zinc-600 transition group-hover:text-emerald-400" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              Nada encontrado para “{query}”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
