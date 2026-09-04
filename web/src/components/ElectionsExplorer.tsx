"use client";

import { useState } from "react";
import Link from "next/link";
import type { ElectionSnapshot, IndexEntry } from "@/lib/data";
import { formatSnapshotDate } from "@/lib/freshness";

export default function ElectionsExplorer({
  snapshot,
  index,
}: {
  snapshot: ElectionSnapshot | null;
  index: IndexEntry[];
}) {
  const [year, setYear] = useState("2026");
  const [query, setQuery] = useState("");
  const [uf, setUf] = useState("");
  const [limit, setLimit] = useState(24);
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const matches = (name: string, state: string, party: string) =>
    (!uf || uf === state) &&
    normalize(`${name} ${party}`).includes(normalize(query));
  const entries = (snapshot?.entries ?? []).filter((e) =>
    matches(`${e.name} ${e.candidateName}`, e.uf, e.party),
  );
  const historical = index.filter(
    (e) =>
      e.sources.includes("tse") && matches(e.name, e.uf ?? "", e.party ?? ""),
  );
  return (
    <section className="space-y-6">
      <div
        className="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
        aria-label="Ano eleitoral"
      >
        {["2026", "2022"].map((value) => (
          <button
            key={value}
            onClick={() => {
              setYear(value);
              setLimit(24);
            }}
            aria-pressed={year === value}
            className={`rounded-lg px-5 py-2 text-sm ${year === value ? "bg-emerald-400 text-zinc-950" : "text-zinc-400 hover:text-white"}`}
          >
            {value}
            {value === "2022" ? " · histórico" : ""}
          </button>
        ))}
      </div>
      {year === "2026" ? (
        <div className="rounded-2xl border border-sky-300/15 bg-sky-300/[0.03] p-5">
          <h2 className="font-medium text-sky-100">
            Candidaturas de parlamentares acompanhados
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {snapshot
              ? `${snapshot.matchedProfiles} perfis pareados entre ${snapshot.scopeProfiles} acompanhados. Arquivo do TSE gerado em ${formatSnapshotDate(snapshot.sourceGeneratedAt)}; importado em ${formatSnapshotDate(snapshot.importedAt)}.`
              : "Os dados de 2026 ainda não foram importados nesta versão. Isso não significa ausência de candidaturas ou de receitas de campanha."}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {snapshot?.financeImported
              ? `Receitas declaradas no arquivo de ${formatSnapshotDate(snapshot.financeGeneratedAt)}. Valores parciais sujeitos a retificações.`
              : "Receitas de campanha de 2026 ainda não importadas. As doações dos grafos continuam identificadas como eleições de 2022."}
          </p>
          <a
            href="https://divulgacandcontas.tse.jus.br/divulga/#/home"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm text-emerald-300 hover:underline"
          >
            Consultar candidaturas e contas no TSE ↗
          </a>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.03] p-5 text-sm leading-relaxed text-zinc-400">
          Doações das eleições de 2022 disponíveis nos grafos. Partido e UF
          abaixo são os do cadastro parlamentar da versão, não necessariamente
          os de 2022. Este recorte não é uma lista de candidatos de 2026.
        </div>
      )}
      {(year === "2022" || snapshot) && (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="min-w-48 flex-1 text-xs text-zinc-400">
              Nome ou partido
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white"
                placeholder="Buscar parlamentar"
              />
            </label>
            <label className="text-xs text-zinc-400">
              UF
              <select
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="mt-1 block rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white"
              >
                <option value="">Todas</option>
                {[
                  ...new Set([
                    ...(snapshot?.entries.map((e) => e.uf) ?? []),
                    ...index
                      .map((e) => e.uf)
                      .filter((v): v is string => Boolean(v)),
                  ]),
                ]
                  .sort()
                  .map((state) => (
                    <option key={state}>{state}</option>
                  ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-zinc-500" role="status">
            {year === "2026" ? entries.length : historical.length} resultados
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {year === "2026"
              ? entries.slice(0, limit).map((e) => (
                  <Link
                    key={e.politicianId}
                    href={`/politico/${e.politicianId}#eleicoes`}
                    className="rounded-xl border border-white/10 p-4 hover:border-emerald-300/30"
                  >
                    <h3 className="font-medium text-zinc-100">{e.name}</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      {e.office} · {e.party}/{e.uf} · nº {e.ballotNumber}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      Situação no TSE: {e.status}
                    </p>
                    <p className="mt-2 text-sm text-emerald-200">
                      {e.totalReceived === null
                        ? "Sem receitas identificadas no recorte importado"
                        : `${e.totalReceived.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em receitas declaradas`}
                    </p>
                  </Link>
                ))
              : historical.slice(0, limit).map((e) => (
                  <Link
                    key={e.id}
                    href={`/politico/${e.id}`}
                    className="rounded-xl border border-white/10 p-4 hover:border-emerald-300/30"
                  >
                    <h3 className="font-medium text-zinc-100">{e.name}</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      {e.party}/{e.uf} · abrir grafo com doações de 2022 →
                    </p>
                  </Link>
                ))}
          </div>
          {(year === "2026" ? entries.length : historical.length) > limit && (
            <button
              onClick={() => setLimit(limit + 24)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-emerald-300 hover:bg-white/5"
            >
              Mostrar mais perfis
            </button>
          )}
          {(year === "2026" ? entries.length : historical.length) === 0 && (
            <p className="rounded-xl border border-white/10 p-5 text-sm text-zinc-400">
              Nenhum perfil corresponde a este recorte e aos filtros.
            </p>
          )}
        </>
      )}
      <p className="text-xs leading-relaxed text-zinc-500">
        {snapshot?.note ??
          "O GrafoBR acompanha um recorte de parlamentares federais. Não é um cadastro completo de candidaturas. Não encontrar um perfil não significa que a pessoa não se candidatou."}
      </p>
      <div className="flex flex-wrap gap-4 text-xs text-emerald-300">
        <a
          href="https://dadosabertos.tse.jus.br/dataset/candidatos-2026"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          Fonte: candidaturas 2026 ↗
        </a>
        <a
          href="https://dadosabertos.tse.jus.br/dataset/prestacao-de-contas-eleitorais-2026"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          Fonte: contas eleitorais 2026 ↗
        </a>
      </div>
    </section>
  );
}
