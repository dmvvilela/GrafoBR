"use client";

// Home / demo page. Fetches the synthetic ego-network from /public/data and hands
// it to <NetworkGraph>. This mirrors the real architecture: the frontend reads
// static JSON files; it never talks to a database. Once NetworkGraph is a real D3
// graph (Phase 1), this page lights up. Phase 4 replaces this with a search home +
// SSG per-politician pages (see app/politico/[id]/page.tsx).

import { useEffect, useState } from "react";
import NetworkGraph from "@/components/NetworkGraph";
import type { EgoNetwork, GraphNode } from "@/lib/contract";
import { CATEGORY_LABELS } from "@/lib/graph-colors";

export default function Home() {
  const [data, setData] = useState<EgoNetwork | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    fetch("/data/sample-ego-network.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">GrafoBR</h1>
        <p className="text-sm text-gray-600">
          Conexões de dados públicos · <strong>scaffold</strong> · dados sintéticos
        </p>
      </header>

      {error && (
        <p className="text-sm text-red-600">Falha ao carregar dados: {error}</p>
      )}

      {!data && !error && (
        <p className="text-sm text-gray-500">Carregando…</p>
      )}

      {data && (
        <>
          <p className="mb-4 text-sm text-gray-600">
            {data.meta?.disclaimer ??
              "Dados públicos. Conexões não são acusações de irregularidade."}
          </p>

          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_280px]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">
                Buscar no grafo
              </span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Nome da pessoa, empresa ou doador"
              />
            </label>

            <aside className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
              {selectedNode ? (
                <>
                  <p className="font-semibold text-gray-900">{selectedNode.name}</p>
                  <p className="text-gray-500">
                    {CATEGORY_LABELS[selectedNode.category]} ·{" "}
                    {selectedNode.connectionCount} conexões
                  </p>
                </>
              ) : (
                <p className="text-gray-500">Selecione um nó para ver o resumo.</p>
              )}
            </aside>
          </div>

          <NetworkGraph
            data={data}
            searchQuery={searchQuery}
            onSelectNode={setSelectedNode}
          />
        </>
      )}
    </main>
  );
}
