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
