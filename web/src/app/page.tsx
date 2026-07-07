import {
  getCeapTrails,
  getChanges,
  getEmendaTrails,
  getHighlights,
  getIndex,
  getMeta,
  getSignals,
} from "@/lib/data";
import SearchDirectory from "@/components/SearchDirectory";
import MoneyTrails from "@/components/MoneyTrails";
import SnapshotChanges from "@/components/SnapshotChanges";
import SnapshotSignals from "@/components/SnapshotSignals";

function formatUpdated(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export default async function Home() {
  const [index, highlights, ceapTrails, emendaTrails, meta, signals, changes] = await Promise.all([
    getIndex(),
    getHighlights(),
    getCeapTrails(),
    getEmendaTrails(),
    getMeta(),
    getSignals(),
    getChanges(),
  ]);
  const updated = formatUpdated(meta?.generatedAt);

  return (
    <div className="space-y-12">
      <section className="pt-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {index.length} {index.length === 1 ? "parlamentar" : "parlamentares"}
          {updated && (
            <>
              {" · "}
              <span className="text-zinc-500">atualizado em {updated}</span>
            </>
          )}
        </div>

        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Explore <span className="gradient-text">conexões</span> registradas de
          parlamentares federais.
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-pretty text-zinc-400">
          Doadores de campanha, despesas de cota, empresas e contratos de parlamentares federais — a
          partir de dados abertos e fontes oficiais.
        </p>
      </section>

      <MoneyTrails
        highlights={highlights}
        ceapTrails={ceapTrails}
        emendaTrails={emendaTrails}
      />

      <SnapshotSignals signals={signals} />

      <SnapshotChanges changes={changes} />

      <SearchDirectory index={index} />
    </div>
  );
}
