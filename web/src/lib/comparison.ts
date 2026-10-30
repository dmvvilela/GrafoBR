import type { EgoNetwork, GraphLink, GraphNode } from "./contract";

export interface SharedConnection {
  entityId: string;
  left: GraphNode;
  right: GraphNode;
  leftLinks: GraphLink[];
  rightLinks: GraphLink[];
}

// A name is a label, never identity. Only show edges directly connecting each
// profile to the same pipeline-issued entity; company contracts are another hop.
export function sharedConnections(a: EgoNetwork, b: EgoNetwork): SharedConnection[] {
  if (a.meta.egoId === b.meta.egoId) return [];
  const direct = (ego: EgoNetwork, node: GraphNode) => ego.links.filter((link) =>
    (link.source === ego.meta.egoId && link.target === node.id) ||
    (link.target === ego.meta.egoId && link.source === node.id));
  const left = new Map(a.nodes.filter((n) => n.entityId && n.category !== "politician")
    .map((n) => [n.entityId!, n]));
  return b.nodes.flatMap((right) => {
    const node = right.entityId ? left.get(right.entityId) : undefined;
    if (!node || !right.entityId) return [];
    const leftLinks = direct(a, node);
    const rightLinks = direct(b, right);
    return leftLinks.length && rightLinks.length
      ? [{ entityId: right.entityId, left: node, right, leftLinks, rightLinks }] : [];
  }).sort((x, y) => x.left.name.localeCompare(y.left.name, "pt-BR"));
}

export function comparisonVersion(a: EgoNetwork, b: EgoNetwork): string {
  return `${a.meta.generatedAt}|${b.meta.generatedAt}`;
}

export function comparisonPath(a: string, b: string, entity?: string, version?: string): string {
  const query = new URLSearchParams({ a, b });
  if (entity && version) { query.set("entity", entity); query.set("v", version); }
  return `/comparar?${query}`;
}

export function selectionForVersion(shared: SharedConnection[], entity: string | null,
  savedVersion: string | null, currentVersion: string): string | null {
  if (savedVersion !== currentVersion) return null;
  return shared.some((item) => item.entityId === entity) ? entity : null;
}
