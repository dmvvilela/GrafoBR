"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import { ArrowUpRight, Search } from "lucide-react";
import type { IndexEntry } from "@/lib/data";
import Avatar from "@/components/Avatar";

function DeputyCard({ entry }: { entry: IndexEntry }) {
  return (
    <Link
      href={`/politico/${entry.id}`}
      className="group flex items-center gap-3.5 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 transition hover:-translate-y-0.5 hover:border-emerald-400/30 hover:bg-white/[0.05]"
    >
      <Avatar id={entry.id} name={entry.name} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-100">
          {entry.name}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
          {entry.party && (
            <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium text-zinc-300 ring-1 ring-white/10">
              {entry.party}
            </span>
          )}
          {entry.uf && <span>{entry.uf}</span>}
        </span>
      </span>
      <ArrowUpRight
        size={16}
        className="shrink-0 text-zinc-600 transition group-hover:text-emerald-400"
      />
    </Link>
  );
}

export default function SearchDirectory({ index }: { index: IndexEntry[] }) {
  const [query, setQuery] = useState("");

  const fuse = useMemo(
    () => new Fuse(index, { keys: ["name", "party", "uf"], threshold: 0.34 }),
    [index],
  );

  const results = query.trim()
    ? fuse.search(query).map((r) => r.item)
    : index;

  return (
    <section className="space-y-5">
      <div className="relative mx-auto max-w-xl">
        <Search
          size={17}
          className="absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-500"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar deputado por nome, partido ou estado"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pr-4 pl-11 text-sm text-zinc-100 shadow-sm transition outline-none placeholder:text-zinc-500 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
        />
      </div>

      <p className="text-center text-xs text-zinc-500">
        {results.length} {results.length === 1 ? "resultado" : "resultados"}
      </p>

      {results.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((entry) => (
            <DeputyCard key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-zinc-500">
          Nenhum deputado encontrado para “{query}”.
        </p>
      )}
    </section>
  );
}
