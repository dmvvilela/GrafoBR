// Build-time data access. The static site reads the pipeline's JSON from
// public/data (populated by scripts/sync-data.mjs). No runtime database.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { EgoNetwork } from "@/lib/contract";

const DATA_DIR = path.join(process.cwd(), "public", "data");

export interface IndexEntry {
  id: number;
  name: string;
  party?: string | null;
  uf?: string | null;
  chamber?: "camara" | "senado";
  photo?: string | null;
  sources: string[];
  path: string;
}

export async function getIndex(): Promise<IndexEntry[]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "index.json"), "utf-8");
    const entries = JSON.parse(raw) as IndexEntry[];
    return entries.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  } catch {
    return [];
  }
}

export async function getEgo(id: string): Promise<EgoNetwork | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw) as EgoNetwork;
  } catch {
    return null;
  }
}

export interface Highlight {
  id: number;
  name: string;
  party?: string | null;
  uf?: string | null;
  company: string;
  value: number;
  org: string;
}

export async function getHighlights(): Promise<Highlight[]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "_highlights.json"), "utf-8");
    return JSON.parse(raw) as Highlight[];
  } catch {
    return [];
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export const getContractRanking = () =>
  readJson<Highlight[]>("_contract-ranking.json", []);

export interface CeapTrail {
  supplier: string;
  total: number;
  deputies: number;
  category: string;
}

export interface EmendaTrail {
  id: number;
  name: string;
  party?: string | null;
  uf?: string | null;
  empenhado: number;
  pago: number;
  topArea?: string | null;
  areas: number;
}

export async function getEmendaTrails(): Promise<EmendaTrail[]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "_emenda-trails.json"), "utf-8");
    return JSON.parse(raw) as EmendaTrail[];
  } catch {
    return [];
  }
}

export const getEmendaRanking = () =>
  readJson<EmendaTrail[]>("_emenda-ranking.json", []);
export const getCeapRanking = () =>
  readJson<CeapTrail[]>("_ceap-ranking.json", []);

export async function getCeapTrails(): Promise<CeapTrail[]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "_ceap-trails.json"), "utf-8");
    return JSON.parse(raw) as CeapTrail[];
  } catch {
    return [];
  }
}

export interface Meta {
  /** ISO timestamp of when the pipeline last rebuilt the data snapshot. */
  generatedAt: string;
  deputies?: number;
}

export async function getMeta(): Promise<Meta | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "_meta.json"), "utf-8");
    return JSON.parse(raw) as Meta;
  } catch {
    return null;
  }
}

export interface ObraProject {
  id: string;
  nome: string;
  uf?: string | null;
  municipio?: string | null;
  codigoMunicipio?: string | number | null;
  situacao?: string | null;
  especie?: string | null;
  natureza?: string | null;
  percentualFisico?: number | null;
  valorPrevisto?: number | null;
  valorEmpenhado?: number | null;
  ratioEmpenhado?: number | null;
  dataFinalPrevista?: string | null;
  diasAtraso?: number;
  paralisacoes?: number;
  motivosParalisacao?: string[] | null;
  signals: string[];
  executor?: string | null;
  repassador?: string | null;
  orgao?: string | null;
  sourceIds?: {
    idUnico?: string | null;
    idProjetoInvestimento?: string | number | null;
  };
}

export interface ObrasIndex {
  meta: {
    generatedAt: string;
    source: string;
    sourceUrl: string;
    disclaimer: string;
    counts: { discovered: number; flagged: number; paralisada: number; atrasada: number };
    discoveryNote?: string;
  };
  paralisadas: ObraProject[];
  atrasadas: ObraProject[];
  all: ObraProject[];
}

export async function getObras(): Promise<ObrasIndex | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, "_obras.json"), "utf-8");
    return JSON.parse(raw) as ObrasIndex;
  } catch {
    return null;
  }
}
