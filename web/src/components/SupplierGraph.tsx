"use client";
import { useState } from "react";
import Link from "next/link";
import NetworkGraph, { type NetworkGraphData } from "@/components/NetworkGraph";
import type { GraphNode } from "@/lib/contract";
export default function SupplierGraph({
  graph,
  targets,
  caption,
}: {
  graph: NetworkGraphData;
  targets: Record<number, { href: string; label: string }>;
  caption: string;
}) {
  const [selected, setSelected] = useState<GraphNode | null>(null);
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10">
      <div className="p-5 sm:p-6">
        <p className="text-xs uppercase tracking-widest text-emerald-300">
          O caminho documental
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          Órgão → contrato → fornecedor
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          {caption} Selecione um ponto para ver suas conexões e abrir o
          registro. A lista abaixo oferece acesso aos mesmos documentos.
        </p>
      </div>
      <label className="mx-5 mb-5 block text-xs text-zinc-400 sm:mx-6">
        Selecionar ponto do grafo
        <select
          value={selected?.id ?? ""}
          onChange={(e) =>
            setSelected(
              e.target.value === ""
                ? null
                : (graph.nodes.find((n) => n.id === Number(e.target.value)) ??
                    null),
            )
          }
          className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">Todos os pontos</option>
          {graph.nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </label>
      <div className="min-w-0 border-y border-white/5">
        <NetworkGraph
          data={graph}
          compact
          legendLabels={{
            supplier: "Fornecedor",
            politician: "Perfil",
            other: "Órgão / contrato",
          }}
          focusId={selected?.id ?? null}
          onSelectNode={setSelected}
        />
      </div>
      <div className="p-5 text-sm">
        {selected ? (
          <div className="mt-4 space-y-3">
            <p className="break-words font-medium text-zinc-100">
              {selected.name}
            </p>
            {graph.links
              .filter(
                (l) => l.source === selected.id || l.target === selected.id,
              )
              .map((l) => (
                <p key={l.id} className="text-xs leading-relaxed text-zinc-400">
                  {l.description}
                </p>
              ))}
            {targets[selected.id] && (
              <Link
                className="inline-block py-2 text-emerald-300"
                href={targets[selected.id].href}
              >
                {targets[selected.id].label} →
              </Link>
            )}
            <button
              className="ml-4 py-2 text-xs text-zinc-400"
              onClick={() => setSelected(null)}
            >
              Limpar seleção
            </button>
          </div>
        ) : (
          <p className="mt-4 text-zinc-500">
            Toque em um ponto do grafo para explorar.
          </p>
        )}
      </div>
    </section>
  );
}
