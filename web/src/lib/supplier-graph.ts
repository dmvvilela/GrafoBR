import type { GraphLink, GraphNode } from "./contract";
import type { StateSupplier, StateContract } from "./state-contracts";
import { contractMoney, contractProfilePath } from "./state-contracts";
import { getEgo } from "./data";
export async function supplierGraph(
  supplier: StateSupplier,
  contracts: StateContract[],
) {
  const nodes: GraphNode[] = [
    { id: 0, name: supplier.name, category: "supplier", connectionCount: 0 },
  ];
  const links: GraphLink[] = [],
    targets: Record<number, { href: string; label: string }> = {
      0: { href: `/fornecedores/${supplier.id}`, label: "Abrir fornecedor" },
    };
  const add = (name: string, category: GraphNode["category"]) => {
    const id = nodes.length;
    nodes.push({ id, name, category, connectionCount: 0 });
    return id;
  };
  const edge = (
    source: number,
    target: number,
    type: GraphLink["connectionType"],
    description: string | null,
  ) => {
    links.push({
      id: links.length,
      source,
      target,
      connectionType: type,
      description,
      strength: 1,
    });
    nodes[source].connectionCount++;
    nodes[target].connectionCount++;
  };
  const agencies = new Map<string, number>();
  for (const c of contracts.slice(0, 12)) {
    // The official contracting authority is identified by its PNCP URL segment.
    const key = c.sourceUrl.split("/")[5];
    let agency = agencies.get(key);
    if (agency === undefined) {
      agency = add(c.agency, "other");
      agencies.set(key, agency);
      targets[agency] = {
        href: `/contratos?uf=${c.uf}&org=${encodeURIComponent(c.agency)}`,
        label: "Ver contratos deste órgão",
      };
    }
    const contract = add(`Contrato ${c.number}/${c.year} · ${c.uf}`, "other");
    targets[contract] = { href: `/contratos/${c.id}`, label: "Abrir contrato" };
    edge(
      agency,
      contract,
      "contrato",
      `${c.agency}: contratante no registro PNCP.`,
    );
    edge(
      contract,
      0,
      "contrato",
      `${c.supplierName}: fornecedor · valor inicial ${contractMoney(c.initialValue)}. Não representa pagamento.`,
    );
  }
  let count = 0;
  for (const connection of supplier.connections
    .filter((c) => c.direct)
    .slice(0, 8)) {
    const graph = await getEgo(String(connection.profileId));
    if (!graph) continue;
    const direct = graph.links.filter(
      (l) =>
        (l.source === connection.nodeId && l.target === connection.profileId) ||
        (l.target === connection.nodeId && l.source === connection.profileId),
    );
    if (!direct.length) continue;
    const profile = add(connection.profileName, "politician");
    targets[profile] = {
      href: contractProfilePath(connection),
      label: "Abrir conexão no grafo original",
    };
    for (const l of direct) edge(profile, 0, l.connectionType, l.description);
    count++;
  }
  return {
    graph: {
      nodes,
      links,
      meta: {
        egoId: 0,
        egoName: supplier.name,
      },
    },
    targets,
    caption: `Exibe ${Math.min(12, contracts.length)} de ${contracts.length} contratos, ordenados por valor inicial, e ${count} conexões diretas de perfis. Os vínculos históricos têm os períodos descritos em cada aresta.`,
  };
}
