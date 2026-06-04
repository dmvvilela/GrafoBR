"use client";

// Home / demo page. Fetches the synthetic ego-network from /public/data and hands
// it to <NetworkGraph>. This mirrors the real architecture: the frontend reads
// static JSON files; it never talks to a database. Once NetworkGraph is a real D3
// graph (Phase 1), this page lights up. Phase 4 replaces this with a search home +
// SSG per-politician pages (see app/politico/[id]/page.tsx).

import { useEffect, useState } from "react";
import NetworkGraph from "@/components/NetworkGraph";
import type { EgoNetwork } from "@/lib/contract";

export default function Home() {
  const [data, setData] = useState<EgoNetwork | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <NetworkGraph data={data} />
        </>
      )}
    </main>
  );
}
