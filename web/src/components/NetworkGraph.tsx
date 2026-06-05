"use client";

// NetworkGraph — D3 force-directed ego graph over the data contract
// (EgoNetwork = { nodes, links }). Readability rules:
//   - labels are OFF by default except the ego; hovering a node reveals its name
//     + its neighbors and dims the rest (hovering the hub just shows the hub, to
//     avoid printing all 60+ leaf names at once). Zooming in past a threshold
//     reveals every label.
//   - the graph auto zoom-to-fits the viewport once the simulation settles.
//   - search (dim non-matches) and focus (clicked node + neighbors) still apply.

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
  focusId?: number | null;
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
const LABELS_ALL_ZOOM = 1.6; // zoom past this -> show every label
const NEIGHBOR_LABEL_CAP = 18; // hovering a node with more neighbors labels only it

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
  focusId = null,
  onSelectNode,
}: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const onSelectNodeRef = useRef(onSelectNode);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchIds = useMemo(() => {
    return new Set(
      data.nodes
        .filter((node) => isNodeMatch(node, normalizedQuery))
        .map((node) => node.id),
    );
  }, [data.nodes, normalizedQuery]);

  const hasSearch = normalizedQuery.length > 0;

  const adjacency = useMemo(() => {
    const map = new Map<number, Set<number>>();
    const add = (a: number, b: number) => {
      if (!map.has(a)) map.set(a, new Set());
      map.get(a)!.add(b);
    };
    for (const link of data.links) {
      add(link.source, link.target);
      add(link.target, link.source);
    }
    return map;
  }, [data.links]);

  const focusSet = useMemo(() => {
    if (focusId == null) return null;
    const set = new Set<number>([focusId]);
    for (const n of adjacency.get(focusId) ?? []) set.add(n);
    return set;
  }, [focusId, adjacency]);

  // Mutable state shared between the (heavy) build effect and the (light)
  // search/focus effect, so hover/search/focus never rebuild the simulation.
  const stateRef = useRef({
    focusSet: null as Set<number> | null,
    hasSearch: false,
    matchIds: new Set<number>(),
  });
  const applyVisibilityRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const egoId = data.meta?.egoId;
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
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", (edge) => Math.max(1.2, (edge.strength ?? 1) * 1.3))
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
      .attr("stroke-width", 1.6)
      .attr("cursor", "pointer")
      .on("click", (_event, graphNode) =>
        onSelectNodeRef.current?.(graphNode),
      );

    node.append("title").text((graphNode) => {
      const label = CATEGORY_LABELS[graphNode.category];
      return `${graphNode.name} · ${label} · ${graphNode.connectionCount} conexões`;
    });

    const label = labelLayer
      .selectAll<SVGTextElement, SimulationNode>("text")
      .data(nodes)
      .join("text")
      .text((graphNode) => graphNode.name)
      .attr("font-size", (graphNode) => (graphNode.id === egoId ? 13 : 12))
      .attr("font-weight", (graphNode) => (graphNode.id === egoId ? 700 : 500))
      .attr("fill", "#e4e4e7")
      .attr("paint-order", "stroke")
      .attr("stroke", "#09090b")
      .attr("stroke-width", 3.5)
      .attr("stroke-linejoin", "round")
      .attr("pointer-events", "none");

    let hoveredId: number | null = null;
    let zoomK = 1;

    function applyVisibility() {
      const { focusSet: fSet, hasSearch: search, matchIds: matches } =
        stateRef.current;
      const hoverNeighbors =
        hoveredId != null ? adjacency.get(hoveredId) ?? new Set<number>() : null;
      const hoverLabels =
        hoverNeighbors && hoverNeighbors.size <= NEIGHBOR_LABEL_CAP;

      const isActive = (id: number): boolean => {
        if (hoveredId != null)
          return id === hoveredId || hoverNeighbors!.has(id);
        if (fSet) return fSet.has(id);
        if (search) return matches.has(id);
        return true;
      };
      const showLabel = (id: number): boolean => {
        if (id === egoId) return true;
        if (hoveredId != null)
          return id === hoveredId || (hoverLabels! && hoverNeighbors!.has(id));
        if (fSet) return fSet.has(id);
        if (search) return matches.has(id);
        return zoomK >= LABELS_ALL_ZOOM;
      };

      node.attr("opacity", (n) => (isActive(n.id) ? 1 : 0.1));
      label
        .attr("display", (n) => (showLabel(n.id) ? null : "none"))
        .attr("opacity", (n) => (isActive(n.id) ? 0.95 : 0.12));
      link.attr("stroke-opacity", (edge) => {
        const a = getLinkedNodeId(edge.source);
        const b = getLinkedNodeId(edge.target);
        if (hoveredId != null)
          return a === hoveredId || b === hoveredId ? 0.9 : 0.05;
        return isActive(a) && isActive(b) ? 0.5 : 0.05;
      });
    }
    applyVisibilityRef.current = applyVisibility;

    node
      .on("mouseenter", (_event, graphNode) => {
        hoveredId = graphNode.id;
        applyVisibility();
      })
      .on("mouseleave", () => {
        hoveredId = null;
        applyVisibility();
      });

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "charge",
        d3.forceManyBody<SimulationNode>().strength(-460).distanceMax(640),
      )
      .force(
        "link",
        d3
          .forceLink<SimulationNode, SimulationLink>(links)
          .id((graphNode) => graphNode.id)
          .distance(115)
          .strength(0.6),
      )
      .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("x", d3.forceX(WIDTH / 2).strength(0.03))
      .force("y", d3.forceY(HEIGHT / 2).strength(0.03))
      .force(
        "collide",
        d3
          .forceCollide<SimulationNode>()
          .radius((graphNode) => radius(graphNode.connectionCount) + 7)
          .strength(0.9),
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
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        root.attr("transform", event.transform.toString());
        const prev = zoomK;
        zoomK = event.transform.k;
        // only relabel when crossing the "show all" threshold (cheap)
        if (prev >= LABELS_ALL_ZOOM !== (zoomK >= LABELS_ALL_ZOOM))
          applyVisibility();
      });

    svg.call(zoom);

    // Frame the whole graph in the viewport once it settles.
    let fitted = false;
    function fitToView() {
      if (fitted) return;
      fitted = true;
      const pad = 48;
      const xs = nodes.map((n) => n.x ?? WIDTH / 2);
      const ys = nodes.map((n) => n.y ?? HEIGHT / 2);
      const minX = Math.min(...xs) - pad;
      const maxX = Math.max(...xs) + pad;
      const minY = Math.min(...ys) - pad;
      const maxY = Math.max(...ys) + pad;
      const w = Math.max(maxX - minX, 1);
      const h = Math.max(maxY - minY, 1);
      const scale = Math.min(WIDTH / w, HEIGHT / h, 1.4);
      const tx = WIDTH / 2 - (scale * (minX + maxX)) / 2;
      const ty = HEIGHT / 2 - (scale * (minY + maxY)) / 2;
      svg
        .transition()
        .duration(500)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }
    simulation.on("end", fitToView);

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
            (graphNode.x ?? 0) + radius(graphNode.connectionCount) + 7,
        )
        .attr("y", (graphNode) => (graphNode.y ?? 0) + 4);
    });

    applyVisibility();

    return () => {
      simulation.stop();
      svg.on(".zoom", null);
      applyVisibilityRef.current = null;
    };
  }, [data, adjacency]);

  // Light effect: push search/focus state in and re-apply visibility (no rebuild).
  useEffect(() => {
    stateRef.current = { focusSet, hasSearch, matchIds };
    applyVisibilityRef.current?.();
  }, [hasSearch, matchIds, focusSet]);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/5 px-4 py-3 text-xs text-zinc-400">
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
          className="graph-canvas h-full w-full touch-none"
          role="img"
          aria-label={`Grafo de conexões de ${data.meta?.egoName ?? "político"}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
        />

        {hasSearch && matchIds.size === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded-md border border-white/10 bg-zinc-900/90 px-3 py-2 text-sm text-zinc-300 shadow-sm backdrop-blur">
            Nenhum nó encontrado para “{searchQuery}”.
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-4 py-3 text-xs text-zinc-500">
        <div>
          {data.nodes.length} nós · {data.links.length} conexões
        </div>
        <div>
          Passe o mouse para ver nomes · arraste · scroll/pinch para aproximar
        </div>
      </div>
    </div>
  );
}
