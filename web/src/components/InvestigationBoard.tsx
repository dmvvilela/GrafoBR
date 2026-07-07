"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EgoNetwork, GraphLink } from "@/lib/contract";
import type { IndexEntry } from "@/lib/data";
import ConnectionExplanation from "@/components/ConnectionExplanation";
import ExportButton from "@/components/ExportButton";
import { CONNECTION_LABELS } from "@/lib/graph-colors";
import { explainConnection } from "@/lib/profile-analysis";

function parseSelected(): Set<number> {
  if (typeof window === "undefined") return new Set();
  const raw = new URLSearchParams(window.location.search).get("edges") ?? "";
  return new Set(
    raw
      .split(",")
      .map((id) => Number(id))
      .filter(Number.isFinite),
  );
}

function boardPayload(ego: EgoNetwork, entry: IndexEntry | null, links: GraphLink[]) {
  return {
    generatedAt: new Date().toISOString(),
    profile: {
      id: entry?.id ?? ego.meta?.egoId ?? null,
      name: entry?.name ?? ego.meta?.egoName ?? null,
      party: entry?.party ?? null,
      uf: entry?.uf ?? null,
    },
    selectedEdges: links.map((link) => ({
      ...link,
      explanation: explainConnection(link, ego),
    })),
    caveat:
      "Board de investigação com registros públicos selecionados; conexões não são acusações.",
  };
}

export default function InvestigationBoard({
  ego,
  entry,
}: {
  ego: EgoNetwork;
  entry: IndexEntry | null;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSelected(parseSelected());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = [...selected].sort((a, b) => a - b);
    if (ids.length) params.set("edges", ids.join(","));
    else params.delete("edges");
    const next = params.toString()
      ? `/investigar/${entry?.id ?? ego.meta?.egoId}?${params.toString()}`
      : `/investigar/${entry?.id ?? ego.meta?.egoId}`;
    window.history.replaceState(null, "", next);
  }, [selected, entry?.id, ego.meta?.egoId]);

  const selectedLinks = useMemo(
    () => ego.links.filter((link) => selected.has(link.id)),
    [ego.links, selected],
  );
  const payload = useMemo(
    () => boardPayload(ego, entry, selectedLinks),
    [ego, entry, selectedLinks],
  );
  const suggested = ego.links
    .toSorted((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
    .slice(0, 36);

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-100">
              Board selecionado
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Escolha vínculos, compartilhe a URL ou exporte um pacote JSON.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10"
            >
              {copied ? "Copiado" : "Copiar link"}
            </button>
            <ExportButton
              filename={`${entry?.id ?? ego.meta?.egoId ?? "board"}-investigacao.json`}
              payload={payload}
              label="Exportar board"
            />
          </div>
        </div>

        {selectedLinks.length > 0 ? (
          <div className="mt-4 space-y-2">
            {selectedLinks.map((link) => (
              <ConnectionExplanation key={link.id} ego={ego} link={link} />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-white/[0.02] p-3 text-sm text-zinc-500">
            Nenhum vínculo selecionado ainda.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h2 className="text-sm font-medium text-zinc-100">
          Vínculos disponíveis
        </h2>
        <ul className="mt-3 divide-y divide-white/5">
          {suggested.map((link) => (
            <li key={link.id} className="flex gap-3 py-2.5">
              <input
                type="checkbox"
                checked={selected.has(link.id)}
                onChange={(event) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(link.id);
                    else next.delete(link.id);
                    return next;
                  })
                }
                className="mt-1 h-4 w-4 shrink-0 accent-emerald-400"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-zinc-300">
                    {CONNECTION_LABELS[link.connectionType]}
                  </span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500 ring-1 ring-white/10">
                    edge {link.id}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  {link.description ?? "sem descrição no arquivo"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Link href={`/politico/${entry?.id ?? ego.meta?.egoId}`} className="text-sm text-zinc-400 hover:text-zinc-200">
        Voltar ao grafo
      </Link>
    </div>
  );
}
