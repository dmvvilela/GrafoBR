import type { Metadata } from "next";
import { getEgo, getIndex } from "@/lib/data";
import { promises as fs } from "node:fs";
import path from "node:path";
import { sharedConnections } from "@/lib/comparison";
import ComparePoliticians from "@/components/ComparePoliticians";

export const metadata: Metadata = {
  title: "Comparar parlamentares — GrafoBR",
  description:
    "Explore o que dois parlamentares têm em comum, confira os registros e compartilhe um card com fontes e contexto.",
};

export default async function CompararPage() {
  const entries = await getIndex();
  const suggestions: { a: number; b: number; count: number }[] = [];
  // Existing related index supplies candidates only; verify direct connections
  // against the two actual graphs before inviting a visitor to explore a pair.
  let related: Record<string, { id: number }[]> = {};
  try { related = JSON.parse(await fs.readFile(path.join(process.cwd(), "public/data/_related.json"), "utf8")); } catch { /* Suggestions are optional. */ }
  const used = new Set<number>();
  for (const entry of entries) {
    if (used.has(entry.id)) continue;
    const other = related[entry.id]?.find((candidate) => !used.has(candidate.id) && entries.some((e) => e.id === candidate.id));
    if (!other) continue;
    const [a, b] = await Promise.all([getEgo(String(entry.id)), getEgo(String(other.id))]);
    const count = a && b ? sharedConnections(a, b).length : 0;
    if (!count) continue;
    suggestions.push({ a: entry.id, b: other.id, count });
    used.add(entry.id); used.add(other.id);
    if (suggestions.length === 3) break;
  }
  return (
    <div className="space-y-7">
      <header className="max-w-3xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-emerald-300">Comparar parlamentares</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          O que conecta estes dois?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Escolha dois parlamentares, explore fornecedores, doadores e empresas
          em comum e confira a origem de cada vínculo. Uma conexão é um ponto de
          partida para entender os registros públicos.
        </p>
      </header>
      <ComparePoliticians entries={entries} suggestions={suggestions} />
    </div>
  );
}
