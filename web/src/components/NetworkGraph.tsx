"use client";

// =============================================================================
// NetworkGraph — STUB (Phase 1). Right now it just proves the data loads and
// renders a placeholder. Your job: turn this into a real D3 force-directed graph.
//
// This is the looks-half of the project. It consumes the data contract
// (EgoNetwork = { nodes, links }) and nothing else. See:
//   - ../../../docs/PLAN.md          (Phase 1 = make this real)
//   - ../../../docs/DATA-CONTRACT.md (the shape)
//   - ../lib/contract.ts             (the types)
//   - ../lib/graph-colors.ts         (category/edge colors, ready to use)
//
// IMPLEMENTATION NOTES (d3-force, SVG):
//   1. Build a d3.forceSimulation(nodes) with:
//        .force("charge", d3.forceManyBody().strength(-300))
//        .force("link",   d3.forceLink(links).id(d => d.id).distance(60))
//        .force("center", d3.forceCenter(width/2, height/2))
//        .force("collide",d3.forceCollide().radius(d => radius(d) + 2))
//      NOTE: d3.forceLink mutates link.source/target from number -> node object.
//      Our contract ships them as numbers (node ids); that's exactly what
//      .id(d => d.id) expects. Don't pre-resolve them.
//   2. Node radius: const radius = d3.scaleLinear()
//        .domain([0, d3.max(nodes, n => n.connectionCount) ?? 1]).range([5, 24]).
//   3. Node fill: getCategoryColor(node.category). Edge stroke: getEdgeColor(link.connectionType).
//   4. Render <circle> per node + <line> per link into an <svg>; update positions
//      on simulation "tick". Add d3.drag for nodes and d3.zoom for pan/zoom on a <g>.
//   5. Labels: <text> next to each node (node.name). Keep readable; hide on small zoom.
//   6. Honor the `searchQuery` prop: dim/hide nodes whose name doesn't match (and their
//      edges). Keep it client-side and cheap.
//   7. On node click, call onSelectNode(node) so the page can show a profile panel.
//
// Reference (MIT, study don't copy): Donnadieu/Epstein-File-Explorer
//   client/src/components/network-graph.tsx — same node/link contract.
// =============================================================================

import { useMemo } from "react";
import type { EgoNetwork, GraphNode } from "@/lib/contract";
import { getCategoryColor, CATEGORY_LABELS } from "@/lib/graph-colors";

interface NetworkGraphProps {
  data: EgoNetwork;
  searchQuery?: string;
  onSelectNode?: (node: GraphNode) => void;
}

export default function NetworkGraph({ data }: NetworkGraphProps) {
  const maxConn = useMemo(
    () => Math.max(1, ...data.nodes.map((n) => n.connectionCount)),
    [data.nodes],
  );

  // ---- PLACEHOLDER RENDER (replace with the SVG force graph) ----
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-6">
      <p className="mb-4 text-sm font-medium text-amber-700">
        ⚠️ NetworkGraph stub — replace with the D3 force graph (Phase 1). The data
        below is loaded from the contract, proving the seam works.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            Nodes ({data.nodes.length})
          </h3>
          <ul className="space-y-1 text-sm">
            {data.nodes.map((n) => (
              <li key={n.id} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: getCategoryColor(n.category) }}
                />
                <span className="font-medium">{n.name}</span>
                <span className="text-gray-400">
                  · {CATEGORY_LABELS[n.category]} · {n.connectionCount} conexões
                  {" "}
                  (size→{(5 + (19 * n.connectionCount) / maxConn).toFixed(0)}px)
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            Links ({data.links.length})
          </h3>
          <ul className="space-y-1 text-sm">
            {data.links.map((l) => (
              <li key={l.id} className="text-gray-600">
                <code className="text-xs">
                  {l.source} → {l.target}
                </code>{" "}
                <span className="font-medium">{l.connectionType}</span>
                {l.description ? (
                  <span className="text-gray-400"> · {l.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
