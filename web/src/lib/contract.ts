// TypeScript mirror of contract/ego-network.schema.json — THE seam.
// If you change this, also change the JSON Schema and the sample fixture. See
// ../../../docs/DATA-CONTRACT.md.

export type NodeCategory =
  | "politician"
  | "company"
  | "donor"
  | "supplier"
  | "destino"
  | "relative"
  | "other";

export type ConnectionType =
  | "socio" // company ownership (quadro de sócios)
  | "doacao" // campaign donation
  | "despesa" // parliamentary quota expense (CEAP)
  | "contrato" // public contract
  | "emenda" // individual parliamentary amendment (emenda individual)
  | "parente" // derived family tie — treat conservatively (see LEGAL.md)
  | "other";

export interface GraphNode {
  id: number; // opaque — never a CPF/CNPJ
  name: string;
  category: NodeCategory; // → node color
  connectionCount: number; // node degree → node size
}

export interface GraphLink {
  id: number;
  source: number; // node id (D3 SimulationLinkDatum resolves to GraphNode at runtime)
  target: number; // node id
  connectionType: ConnectionType; // → edge color
  description: string | null;
  strength: number; // currently unused in rendering
}

export interface EgoNetworkMeta {
  egoId?: number;
  egoName?: string;
  chamber?: "camara" | "senado";
  photo?: string | null;
  generatedAt?: string;
  sources?: string[];
  summary?: string | null; // filled by build-time AI (Phase 5)
  disclaimer?: string;
}

export interface EgoNetwork {
  meta?: EgoNetworkMeta;
  nodes: GraphNode[];
  links: GraphLink[];
}
