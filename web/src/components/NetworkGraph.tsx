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

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { EgoNetwork, GraphLink, GraphNode } from "@/lib/contract";
import {
  CATEGORY_LABELS,
  CONNECTION_LABELS,
  getCategoryColor,
  getEdgeColor,
} from "@/lib/graph-colors";

interface NetworkGraphProps {
  data: EgoNetwork;
  searchQuery?: string;
  onSelectNode?: (node: GraphNode) => void;
}

type SimulationNode = GraphNode & d3.SimulationNodeDatum;
type SimulationLink = Omit<GraphLink, "source" | "target"> &
  d3.SimulationLinkDatum<SimulationNode> & {
    source: number | SimulationNode;
    target: number | SimulationNode;
  };

const WIDTH = 960;
const HEIGHT = 560;

function getLinkedNodeId(node: number | string | SimulationNode): number {
  return typeof node === "object" ? node.id : Number(node);
}

function isNodeMatch(node: GraphNode, normalizedQuery: string): boolean {
  return (
    normalizedQuery.length === 0 ||
    node.name.toLowerCase().includes(normalizedQuery)
  );
}

export default function NetworkGraph({
  data,
  searchQuery = "",
  onSelectNode,
}: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchIds = useMemo(() => {
    return new Set(
      data.nodes
        .filter((node) => isNodeMatch(node, normalizedQuery))
        .map((node) => node.id),
    );
  }, [data.nodes, normalizedQuery]);

  const hasSearch = normalizedQuery.length > 0;

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const nodes: SimulationNode[] = data.nodes.map((node) => ({ ...node }));
    const links: SimulationLink[] = data.links.map((link) => ({ ...link }));
    const radius = d3
      .scaleLinear()
      .domain([0, d3.max(nodes, (node) => node.connectionCount) ?? 1])
      .range([5, 24]);

    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();

    const root = svg.append("g").attr("class", "graph-root");
    const linkLayer = root.append("g").attr("class", "graph-links");
    const nodeLayer = root.append("g").attr("class", "graph-nodes");
    const labelLayer = root.append("g").attr("class", "graph-labels");

    const link = linkLayer
      .selectAll<SVGLineElement, SimulationLink>("line")
      .data(links)
      .join("line")
      .attr("stroke", (edge) => getEdgeColor(edge.connectionType))
      .attr("stroke-opacity", (edge) => {
        const sourceId = getLinkedNodeId(edge.source);
        const targetId = getLinkedNodeId(edge.target);
        return !hasSearch || (matchIds.has(sourceId) && matchIds.has(targetId))
          ? 0.72
          : 0.1;
      })
      .attr("stroke-width", (edge) => Math.max(1.5, (edge.strength ?? 1) * 1.4))
      .attr("stroke-linecap", "round");

    link.append("title").text((edge) => {
      const label = CONNECTION_LABELS[edge.connectionType];
      return edge.description ? `${label}: ${edge.description}` : label;
    });

    const node = nodeLayer
      .selectAll<SVGCircleElement, SimulationNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (graphNode) => radius(graphNode.connectionCount))
      .attr("fill", (graphNode) => getCategoryColor(graphNode.category))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.8)
      .attr("opacity", (graphNode) =>
        !hasSearch || matchIds.has(graphNode.id) ? 1 : 0.18,
      )
      .attr("cursor", "grab")
      .on("click", (_event, graphNode) => onSelectNode?.(graphNode));

    node.append("title").text((graphNode) => {
      const label = CATEGORY_LABELS[graphNode.category];
      return `${graphNode.name} · ${label} · ${graphNode.connectionCount} conexões`;
    });

    const label = labelLayer
      .selectAll<SVGTextElement, SimulationNode>("text")
      .data(nodes)
      .join("text")
      .text((graphNode) => graphNode.name)
      .attr("font-size", 12)
      .attr("font-weight", (graphNode) =>
        graphNode.id === data.meta?.egoId ? 700 : 500,
      )
      .attr("fill", "#111827")
      .attr("paint-order", "stroke")
      .attr("stroke", "#f9fafb")
      .attr("stroke-width", 3)
      .attr("stroke-linejoin", "round")
      .attr("opacity", (graphNode) =>
        !hasSearch || matchIds.has(graphNode.id) ? 0.92 : 0.16,
      )
      .attr("pointer-events", "none");

    const simulation = d3
      .forceSimulation(nodes)
      .force("charge", d3.forceManyBody<SimulationNode>().strength(-300))
      .force(
        "link",
        d3
          .forceLink<SimulationNode, SimulationLink>(links)
          .id((graphNode) => graphNode.id)
          .distance(90),
      )
      .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        "collide",
        d3
          .forceCollide<SimulationNode>()
          .radius((graphNode) => radius(graphNode.connectionCount) + 4),
      );

    const drag = d3
      .drag<SVGCircleElement, SimulationNode>()
      .on("start", (event, graphNode) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        graphNode.fx = graphNode.x;
        graphNode.fy = graphNode.y;
      })
      .on("drag", (event, graphNode) => {
        graphNode.fx = event.x;
        graphNode.fy = event.y;
      })
      .on("end", (event, graphNode) => {
        if (!event.active) simulation.alphaTarget(0);
        graphNode.fx = null;
        graphNode.fy = null;
      });

    node.call(drag);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 4])
      .on("zoom", (event) => {
        root.attr("transform", event.transform.toString());
        label.attr("display", event.transform.k < 0.55 ? "none" : null);
      });

    svg.call(zoom);

    simulation.on("tick", () => {
      link
        .attr("x1", (edge) => (edge.source as SimulationNode).x ?? 0)
        .attr("y1", (edge) => (edge.source as SimulationNode).y ?? 0)
        .attr("x2", (edge) => (edge.target as SimulationNode).x ?? 0)
        .attr("y2", (edge) => (edge.target as SimulationNode).y ?? 0);

      node
        .attr("cx", (graphNode) => graphNode.x ?? 0)
        .attr("cy", (graphNode) => graphNode.y ?? 0);

      label
        .attr(
          "x",
          (graphNode) =>
            (graphNode.x ?? 0) + radius(graphNode.connectionCount) + 8,
        )
        .attr("y", (graphNode) => (graphNode.y ?? 0) + 4);
    });

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
    };
  }, [data, hasSearch, matchIds, onSelectNode]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-gray-200 px-4 py-3 text-xs text-gray-600">
        {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
          <span key={category} className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: getCategoryColor(
                  category as GraphNode["category"],
                ),
              }}
            />
            {label}
          </span>
        ))}
      </div>

      <div className="relative h-[560px]">
        <svg
          ref={svgRef}
          className="h-full w-full touch-none"
          role="img"
          aria-label={`Grafo de conexões de ${data.meta?.egoName ?? "político"}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
        />

        {hasSearch && matchIds.size === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded-md border border-gray-200 bg-white/90 px-3 py-2 text-sm text-gray-600 shadow-sm">
            Nenhum nó encontrado para “{searchQuery}”.
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-xs text-gray-500">
        <div>
          {data.nodes.length} nós · {data.links.length} conexões
        </div>
        <div>
          Arraste os nós; use scroll ou pinch para aproximar e navegar.
        </div>
      </div>
    </div>
  );
}
