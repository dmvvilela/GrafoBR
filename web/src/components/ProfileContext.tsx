import Link from "next/link";
import type { ElectionEntry, ElectionSnapshot, PressArticle } from "@/lib/data";
import { formatSnapshotDate } from "@/lib/freshness";

export default function ProfileContext({
  election,
  snapshot,
  articles,
}: {
  election?: ElectionEntry;
  snapshot: ElectionSnapshot | null;
  articles: PressArticle[];
}) {
  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      <section
        id="eleicoes"
        className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
      >
        <h2 className="font-semibold">Eleições 2026</h2>
        {election ? (
          <>
            <p className="mt-3 text-sm text-zinc-300">
              {election.candidateName} · {election.office} · {election.party}/
              {election.uf} · nº {election.ballotNumber}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Situação no TSE: {election.status}
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              {election.totalReceived === null
                ? "Receitas não identificadas no recorte importado; não equivale a receita zero."
                : `Receitas declaradas: ${election.totalReceived.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${election.receiptCount} registros). Valores parciais.`}
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Candidaturas: arquivo de{" "}
              {formatSnapshotDate(snapshot?.sourceGeneratedAt)}.{" "}
              {snapshot?.financeImported
                ? `Receitas: arquivo de ${formatSnapshotDate(snapshot.financeGeneratedAt)}.`
                : "Receitas ainda não importadas."}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            {snapshot
              ? "Não há candidatura pareada com segurança para este perfil no recorte importado. Isso não significa que a pessoa não se candidatou."
              : "Dados de 2026 ainda não importados. As doações exibidas no grafo são das eleições de 2022."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-emerald-300">
          <Link href="/eleicoes" className="hover:underline">
            Explorar eleições →
          </Link>
          <a
            href="https://divulgacandcontas.tse.jus.br/divulga/#/home"
            target="_blank"
            rel="noreferrer"
            className="hover:underline"
          >
            Consultar TSE ↗
          </a>
        </div>
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="font-semibold">Na imprensa</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Links com associação ao parlamentar revisada. Reportagens são contexto
          editorial; não criam vínculos no grafo.
        </p>
        {articles.length ? (
          <ul className="mt-4 space-y-4">
            {articles.map((article) => (
              <li key={article.url}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-zinc-200 hover:text-emerald-300 hover:underline"
                >
                  {article.title} ↗
                </a>
                <p className="mt-1 text-xs text-zinc-500">
                  {article.publisher} · publicado em{" "}
                  {formatSnapshotDate(article.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">
            Nenhuma matéria revisada nesta versão.
          </p>
        )}
      </section>
    </div>
  );
}
