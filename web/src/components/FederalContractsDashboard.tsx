"use client";
import { useEffect, useMemo, useState } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import {
  assertFederalSnapshot,
  filterFederalContracts,
  summarizeFederalContracts,
  type FederalSnapshot,
} from "@/lib/federal-contracts";
import {
  contractDate,
  contractMoney,
  contractSourceDate,
} from "@/lib/state-contracts";
const powers: Record<string, string> = {
  E: "Executivo",
  L: "Legislativo",
  J: "Judiciário",
  N: "Não se aplica",
};
const integer = (v: number) => v.toLocaleString("pt-BR");
const input =
  "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100";
export default function FederalContractsDashboard({
  version,
  initialSummary,
}: {
  version: string;
  initialSummary: ReturnType<typeof summarizeFederalContracts>;
}) {
  const [data, setData] = useState<FederalSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [limit, setLimit] = useState(24);
  const [shareStatus, setShareStatus] = useState("");
  const [filters, setFilters] = useQueryStates(
    {
      uf: parseAsString.withDefault(""),
      power: parseAsString.withDefault(""),
      org: parseAsString.withDefault(""),
      q: parseAsString.withDefault(""),
      sort: parseAsString.withDefault("value"),
      v: parseAsString.withDefault(""),
    },
    { history: "replace", shallow: true },
  );
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch(`/data/_federal-contracts.json?v=${encodeURIComponent(version)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        return response.json() as Promise<FederalSnapshot>;
      })
      .then((snapshot) => {
        assertFederalSnapshot(snapshot);
        if (snapshot.version !== version) throw new Error("Snapshot changed");
        setData(snapshot);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [version, attempt]);
  const rows = useMemo(
    () => filterFederalContracts(data?.contracts ?? [], filters),
    [data, filters],
  );
  const summary = useMemo(
    () => (data ? summarizeFederalContracts(rows) : initialSummary),
    [data, rows, initialSummary],
  );
  const agencies = useMemo(
    () =>
      [
        ...new Map(
          (data?.contracts ?? [])
            .filter(
              (c) =>
                (!filters.uf || c.uf === filters.uf) &&
                (!filters.power || c.power === filters.power),
            )
            .map((c) => [c.agencyId, c.agency]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    [data, filters.uf, filters.power],
  );
  const ufs = useMemo(
    () => [...new Set(data?.contracts.map((c) => c.uf))].sort(),
    [data],
  );
  const active = !!(filters.uf || filters.power || filters.org || filters.q);
  function change(key: string, value: string) {
    setLimit(24);
    setShareStatus("");
    void setFilters({
      [key]: value,
      ...(["uf", "power"].includes(key) ? { org: "" } : {}),
    });
  }
  async function share() {
    const url = new URL(window.location.href);
    url.searchParams.set("v", version);
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareStatus("Link copiado com os filtros e a versão dos dados.");
    } catch {
      setShareStatus(`Copie este link: ${url.toString()}`);
    }
  }
  return (
    <div className="space-y-7">
      {filters.v && filters.v !== version && (
        <p
          role="status"
          className="rounded-xl border border-amber-300/20 p-4 text-sm text-amber-200"
        >
          Este link foi criado com outra versão dos dados federais. O painel
          mostra a versão atual.
        </p>
      )}
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <fieldset
          disabled={!data}
          className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <legend className="mb-3 text-lg font-medium">
            Explore o recorte federal
          </legend>
          <label className="min-w-0 text-xs text-zinc-400">
            Fornecedor, órgão ou objeto
            <input
              className={input}
              value={filters.q}
              onChange={(e) => change("q", e.target.value)}
              placeholder="Ex.: saúde, universidade, transporte"
            />
          </label>
          <label className="min-w-0 text-xs text-zinc-400">
            UF da unidade contratante
            <select
              className={input}
              value={filters.uf}
              onChange={(e) => change("uf", e.target.value)}
            >
              <option value="">Todas as localizações</option>
              {ufs.map((uf) => (
                <option key={uf} value={uf}>
                  {uf === "EX"
                    ? "EX — Exterior"
                    : uf === "DF"
                      ? "DF — órgãos federais no DF"
                      : uf}
                </option>
              ))}
              {filters.uf && !ufs.includes(filters.uf) && (
                <option value={filters.uf}>{filters.uf} — sem registros</option>
              )}
            </select>
          </label>
          <label className="min-w-0 text-xs text-zinc-400">
            Poder
            <select
              className={input}
              value={filters.power}
              onChange={(e) => change("power", e.target.value)}
            >
              <option value="">Todos os poderes</option>
              {Object.entries(powers).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 text-xs text-zinc-400 sm:col-span-2">
            Órgão federal
            <select
              className={input}
              value={filters.org}
              onChange={(e) => change("org", e.target.value)}
            >
              <option value="">Todos os órgãos</option>
              {agencies.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
              {filters.org && !agencies.some(([id]) => id === filters.org) && (
                <option value={filters.org}>
                  Órgão sem registros neste filtro
                </option>
              )}
            </select>
          </label>
          <label className="min-w-0 text-xs text-zinc-400">
            Ordenar contratos
            <select
              className={input}
              value={filters.sort}
              onChange={(e) => change("sort", e.target.value)}
            >
              <option value="value">Maior valor inicial</option>
              <option value="date">Publicação mais recente</option>
            </select>
          </label>
        </fieldset>
        <p className="mt-4 text-xs leading-relaxed text-zinc-400">
          A localização não muda a esfera: selecionar DF mostra somente órgãos
          federais no DF, sem somar contratos distritais.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          {active && (
            <button
              className="min-h-11 text-sky-300"
              onClick={() => {
                setLimit(24);
                void setFilters({ uf: "", power: "", org: "", q: "" });
              }}
            >
              Limpar filtros
            </button>
          )}
          <button onClick={share} className="min-h-11 text-sky-300">
            Copiar link deste painel
          </button>
        </div>
        {shareStatus && (
          <p role="status" className="mt-2 break-all text-xs text-sky-200">
            {shareStatus}
          </p>
        )}
        {!data && (
          <p role="status" className="mt-3 text-sm text-zinc-300">
            {error
              ? "Não foi possível carregar os contratos. Os totais abaixo são do recorte federal completo."
              : "Carregando contratos… Os totais abaixo são do recorte federal completo."}
          </p>
        )}
        {error && (
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-2 min-h-11 text-sky-300"
          >
            Tentar novamente
          </button>
        )}
      </section>
      <section
        aria-label="Resumo federal"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-live="polite"
      >
        {[
          ["Contratos federais", integer(summary.count)],
          ["Valor inicial total", contractMoney(summary.total)],
          ["Fornecedores", integer(summary.supplierCount)],
          ["Órgãos federais", integer(summary.agencyCount)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-2xl border border-sky-300/15 bg-sky-400/5 p-5"
          >
            <p className="text-xs text-zinc-400">{label}</p>
            <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-sky-100">
              {value}
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              {data && active
                ? "Dentro dos filtros selecionados"
                : "Recorte federal completo"}
            </p>
          </div>
        ))}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        {(
          [
            ["Principais órgãos", summary.agencies],
            ["Principais fornecedores", summary.suppliers],
          ] as const
        ).map(([title, leaders]) => (
          <section
            key={title}
            className="min-w-0 rounded-2xl border border-white/10 p-5 sm:p-6"
          >
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-xs text-zinc-400">
              Os cinco maiores valores iniciais no recorte{" "}
              {data && active ? "filtrado" : "federal"}.
            </p>
            <ol className="mt-5 space-y-5">
              {leaders.map((s) => (
                <li key={s.id} className="min-w-0">
                  <p className="break-words text-sm text-zinc-200">{s.name}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-white/5">
                    <div
                      className="h-1.5 rounded-full bg-sky-300/60"
                      style={{
                        width: `${summary.total ? (s.total / summary.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                    {contractMoney(s.total)} · {integer(s.count)} contratos ·{" "}
                    {summary.total
                      ? ((s.total / summary.total) * 100).toLocaleString(
                          "pt-BR",
                          { maximumFractionDigits: 1 },
                        ) + "% do valor filtrado"
                      : "sem participação calculável"}
                  </p>
                </li>
              ))}
            </ol>
            {leaders.length === 0 && (
              <p className="mt-4 text-sm text-zinc-400">
                Nenhum registro neste recorte.
              </p>
            )}
          </section>
        ))}
      </div>
      {data && (
        <section aria-labelledby="federal-results">
          <h2 id="federal-results" className="text-2xl font-semibold">
            Contratos federais do recorte
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {integer(rows.length)} resultados · mostrando{" "}
            {integer(Math.min(limit, rows.length))}. Abra os detalhes e consulte
            o registro oficial.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {rows.slice(0, limit).map((c) => (
              <article
                key={c.id}
                className="min-w-0 rounded-2xl border border-white/10 p-5"
              >
                <p className="text-xs text-sky-300">
                  FEDERAL · UNIDADE EM {c.uf} · {powers[c.power]}
                </p>
                <h3 className="mt-3 break-words text-base font-medium">
                  {c.supplierName}
                </h3>
                <p className="mt-2 break-words text-xs leading-relaxed text-zinc-400">
                  {c.agency} · {c.unit}
                </p>
                <p className="mt-4 break-words text-2xl font-semibold text-sky-100">
                  {contractMoney(c.initialValue)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Valor inicial · contrato {c.number}/{c.year}
                </p>
                <p className="mt-3 break-words text-sm leading-relaxed text-zinc-300 line-clamp-3">
                  {c.object}
                </p>
                <p className="mt-3 text-xs text-zinc-400">
                  Publicado no PNCP em {contractDate(c.publishedAt)}
                </p>
                <details className="mt-3 text-sm">
                  <summary className="min-h-11 cursor-pointer py-3 text-sky-300">
                    Detalhes do contrato
                  </summary>
                  <p className="break-words leading-relaxed text-zinc-300">
                    {c.object}
                  </p>
                  <dl className="mt-4 space-y-3 text-xs text-zinc-400">
                    {[
                      ["Assinatura", contractDate(c.signedAt)],
                      ["Início da vigência", contractDate(c.startsAt)],
                      ["Fim da vigência", contractDate(c.endsAt)],
                      [
                        "Publicação na fonte",
                        contractSourceDate(c.publishedAt),
                      ],
                      ["Atualização na fonte", contractSourceDate(c.updatedAt)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd className="mt-1 text-zinc-200">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block min-h-11 py-3 text-sm text-sky-300 underline"
                >
                  Consultar contrato no PNCP ↗
                </a>
              </article>
            ))}
          </div>
          {rows.length === 0 && (
            <p className="mt-6 rounded-xl border border-white/10 p-6 text-zinc-400">
              Nenhum contrato federal corresponde aos filtros. Limpe os filtros
              para explorar o recorte completo.
            </p>
          )}
          {rows.length > limit && (
            <button
              onClick={() => setLimit((n) => n + 24)}
              className="mt-6 min-h-11 rounded-xl border border-sky-300/30 px-5 py-3 text-sm text-sky-200"
            >
              Mostrar mais 24 contratos
            </button>
          )}
        </section>
      )}
    </div>
  );
}
