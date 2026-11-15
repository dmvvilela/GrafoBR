import {
  getCeapTrails,
  getUpdates,
  getEmendaTrails,
  getHighlights,
  getIndex,
  getMeta,
  getSignals,
} from "@/lib/data";
import SearchDirectory from "@/components/SearchDirectory";
import MoneyTrails from "@/components/MoneyTrails";
import UpdatesFeed from "@/components/UpdatesFeed";
import SnapshotSignals from "@/components/SnapshotSignals";
import SourceFreshness from "@/components/SourceFreshness";
import Link from "next/link";

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
    getUpdates(),
  ]);
  const updated = formatUpdated(meta?.generatedAt);

  return (
    <div className="space-y-12">
      <section className="pt-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {index.length} {index.length === 1 ? "representante" : "representantes"}
          {updated && (
            <>
              {" · "}
              <span className="text-zinc-500">versão de {updated}</span>
            </>
          )}
        </div>

        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Explore <span className="gradient-text">conexões</span> registradas de
          representantes públicos.
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-pretty text-zinc-400">
          Doadores de campanha, despesas de cota, empresas e contratos de representantes públicos — a
          partir de dados abertos e fontes oficiais. Presidência, governos estaduais, Câmara e Senado, com cobertura indicada em cada perfil.
        </p>
      </section>

      <SourceFreshness generatedAt={meta?.generatedAt} coverage={meta?.sourceCoverage} compact />

      <Link href="/comparar" className="group block rounded-2xl border border-indigo-300/20 bg-gradient-to-r from-indigo-400/10 to-emerald-400/5 p-6 transition hover:border-emerald-300/40 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-300">Explore lado a lado</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-100">O que conecta dois representantes?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">Veja entidades em comum, consulte os registros de cada lado e crie um card com fontes para compartilhar.</p>
        <span className="mt-4 inline-block text-sm font-medium text-emerald-300">Abrir comparação visual →</span>
      </Link>

      <Link href="/meu-estado" className="block rounded-2xl border border-emerald-300/20 bg-gradient-to-r from-emerald-400/10 to-indigo-400/5 p-6 transition hover:border-emerald-300/40 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-300">Meu estado · SP + MG + RJ + DF</p>
        <h2 className="mt-3 text-2xl font-semibold">Seu estado, dos gastos aos fornecedores.</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">Conheça as prioridades das contas anuais, explore fornecedores e siga as publicações de contratos. Cada base com seu período, fontes e cards para compartilhar.</p>
        <span className="mt-4 inline-block text-sm font-medium text-emerald-300">Escolher meu estado →</span>
      </Link>
      <Link href="/estados" className="block rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-6 transition hover:border-emerald-300/40 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-300">Contas dos estados</p>
        <h2 className="mt-2 text-2xl font-semibold">Para onde vai o dinheiro do seu estado?</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">Compare saúde, educação, segurança e investimentos com dados do Tesouro e IBGE. Veja valores por habitante, distribuição e evolução anual.</p>
        <span className="mt-4 inline-block text-sm font-medium text-emerald-300">Comparar estados →</span>
      </Link>

      <MoneyTrails
        highlights={highlights}
        ceapTrails={ceapTrails}
        emendaTrails={emendaTrails}
      />

      <SnapshotSignals signals={signals} />

      <UpdatesFeed history={changes} preview />

      <SearchDirectory index={index} />
    </div>
  );
}
