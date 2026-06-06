"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import { ArrowUpRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { IndexEntry } from "@/lib/data";
import Avatar from "@/components/Avatar";

const PAGE_SIZE = 24;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function norm(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

function firstLetter(name: string) {
  const c = norm(name.trim())[0] ?? "#";
  return /[A-Z]/.test(c) ? c : "#";
}

// Compact windowed pager: 1 … 4 5 [6] 7 8 … 21
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

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
  const [letter, setLetter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  const fuse = useMemo(
    () => new Fuse(index, { keys: ["name", "party", "uf"], threshold: 0.34 }),
    [index],
  );

  // Which initials actually exist, so we can disable empty letters.
  const presentLetters = useMemo(() => {
    const s = new Set<string>();
    for (const e of index) s.add(firstLetter(e.name));
    return s;
  }, [index]);

  const results = useMemo(() => {
    if (query.trim()) return fuse.search(query).map((r) => r.item);
    const base = letter
      ? index.filter((e) => firstLetter(e.name) === letter)
      : index;
    return [...base].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [query, letter, fuse, index]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = results.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function scrollToTop() {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onSearch(value: string) {
    setQuery(value);
    setLetter(null);
    setPage(1);
  }

  function onLetter(l: string) {
    setLetter((cur) => (cur === l ? null : l));
    setQuery("");
    setPage(1);
  }

  function goTo(p: number) {
    setPage(p);
    scrollToTop();
  }

  return (
    <section className="space-y-5">
      <div ref={topRef} className="scroll-mt-6" />

      <div className="relative mx-auto max-w-xl">
        <Search
          size={17}
          className="absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-500"
        />
        <input
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar parlamentar por nome, partido ou estado"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pr-4 pl-11 text-sm text-zinc-100 shadow-sm transition outline-none placeholder:text-zinc-500 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10"
        />
      </div>

      {/* A–Z quick filter (hidden while searching) */}
      {!query.trim() && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => {
              setLetter(null);
              setPage(1);
            }}
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${
              letter === null
                ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            Todos
          </button>
          {ALPHABET.map((l) => {
            const has = presentLetters.has(l);
            return (
              <button
                key={l}
                type="button"
                disabled={!has}
                onClick={() => onLetter(l)}
                className={`min-w-7 rounded-md px-1.5 py-1 text-xs font-medium transition ${
                  letter === l
                    ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                    : has
                      ? "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                      : "cursor-not-allowed text-zinc-700"
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-zinc-500">
        {results.length} {results.length === 1 ? "resultado" : "resultados"}
        {totalPages > 1 && (
          <>
            {" · "}
            página {safePage} de {totalPages}
          </>
        )}
      </p>

      {pageItems.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((entry) => (
              <DeputyCard key={entry.id} entry={entry} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="flex flex-wrap items-center justify-center gap-1 pt-2">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => goTo(safePage - 1)}
                className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition enabled:hover:bg-white/5 enabled:hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              {pageWindow(safePage, totalPages).map((p, i) =>
                p === "…" ? (
                  <span
                    key={`gap-${i}`}
                    className="px-1.5 text-xs text-zinc-600"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goTo(p)}
                    className={`min-w-8 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      p === safePage
                        ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() => goTo(safePage + 1)}
                className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition enabled:hover:bg-white/5 enabled:hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-700"
              >
                Próxima <ChevronRight size={14} />
              </button>
            </nav>
          )}
        </>
      ) : (
        <p className="py-10 text-center text-sm text-zinc-500">
          Nenhum parlamentar encontrado para “{query}”.
        </p>
      )}
    </section>
  );
}
