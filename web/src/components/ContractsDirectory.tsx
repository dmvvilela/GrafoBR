"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import {
  contractDate,
  contractMoney,
  contractPeriod,
  type ContractsDirectoryData,
} from "@/lib/state-contracts";
export default function ContractsDirectory({
  data,
}: {
  data: ContractsDirectoryData;
}) {
  const [filters, setFilters] = useQueryStates(
    {
      uf: parseAsString.withDefault(""),
      year: parseAsString.withDefault(""),
      org: parseAsString.withDefault(""),
      q: parseAsString.withDefault(""),
      view: parseAsString.withDefault("contracts"),
      connected: parseAsString.withDefault(""),
      sort: parseAsString.withDefault("value"),
    },
    { history: "replace", shallow: true },
  );
  const [limit, setLimit] = useState(24);
  const suppliers = useMemo(
    () => new Map(data.suppliers.map((s) => [s.id, s])),
    [data],
  );
  const rows = useMemo(() => {
    const q = filters.q
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return data.contracts
      .filter(
        (c) =>
          (!filters.uf || c.uf === filters.uf) &&
          (!filters.year || String(c.year) === filters.year) &&
          (!filters.org || c.agency === filters.org) &&
          (!filters.connected ||
            suppliers.get(c.supplierId)?.connectionCount) &&
          (!q ||
            `${c.supplierName} ${c.object} ${c.agency}`
              .toLocaleLowerCase("pt-BR")
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .includes(q)),
      )
      .sort((a, b) =>
        filters.sort === "date"
          ? b.publishedAt.localeCompare(a.publishedAt)
          : b.initialValue - a.initialValue,
      );
  }, [data, filters, suppliers]);
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        count: number;
        total: number;
        states: Set<string>;
      }
    >();
    for (const c of rows) {
      const s = map.get(c.supplierId) ?? {
        id: c.supplierId,
        name: suppliers.get(c.supplierId)!.name,
        count: 0,
        total: 0,
        states: new Set<string>(),
      };
      s.count++;
      s.total += c.initialValue;
      s.states.add(c.uf);
      map.set(c.supplierId, s);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows, suppliers]);
  const total = rows.reduce((sum, c) => sum + c.initialValue, 0),
    agencies = [
      ...new Set(
        data.contracts
          .filter((c) => !filters.uf || c.uf === filters.uf)
          .map((c) => c.agency),
      ),
    ].sort();
  const top = grouped.slice(0, 5),
    max = top[0]?.total || 1;
  function change(key: string, value: string) {
    setLimit(24);
    void setFilters({
      ...{ [key]: value },
      ...(key === "uf" ? { org: "" } : {}),
    });
  }
  const input =
    "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-zinc-100";
  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs text-zinc-400 sm:col-span-2">
            Busque fornecedor, órgão ou objeto
            <input
              className={input}
              value={filters.q}
              onChange={(e) => change("q", e.target.value)}
              placeholder="Ex.: medicamentos, obras, transporte"
            />
          </label>
          <label className="text-xs text-zinc-400">
            Estado
            <select
              className={input}
              value={filters.uf}
              onChange={(e) => change("uf", e.target.value)}
            >
              <option value="">SP e MG</option>
              <option value="SP">São Paulo</option>
              <option value="MG">Minas Gerais</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-emerald-300"
              checked={!!filters.connected}
              onChange={(e) => change("connected", e.target.checked ? "1" : "")}
            />
            Com conexões nos grafos
          </label>
        </div>
        <details className="mt-3 rounded-xl border border-white/10 px-4 py-2">
          <summary className="cursor-pointer py-2 text-sm text-zinc-300">
            Mais filtros: órgão, ano e ordenação
            {filters.year || filters.org || filters.sort !== "value"
              ? " · filtros ativos"
              : ""}
          </summary>
          <div className="grid gap-4 pb-3 pt-2 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">
              Ano do contrato
              <select
                className={input}
                value={filters.year}
                onChange={(e) => change("year", e.target.value)}
              >
                <option value="">Todos os anos</option>
                {[...new Set(data.contracts.map((c) => c.year))]
                  .sort((a, b) => b - a)
                  .map((y) => (
                    <option key={y}>{y}</option>
                  ))}
              </select>
            </label>
            <label className="min-w-0 text-xs text-zinc-400 sm:col-span-2">
              Órgão contratante
              <select
                className={input}
                value={filters.org}
                onChange={(e) => change("org", e.target.value)}
              >
                <option value="">Todos os órgãos</option>
                {agencies.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Ordenação dos contratos
              <select
                className={input}
                value={filters.sort}
                onChange={(e) => change("sort", e.target.value)}
              >
                <option value="value">Maior valor inicial</option>
                <option value="date">Publicação mais recente</option>
              </select>
            </label>
          </div>
        </details>
        <button
          onClick={() => {
            setLimit(24);
            void setFilters({
              uf: "",
              year: "",
              org: "",
              q: "",
              connected: "",
              sort: "value",
            });
          }}
          className="mt-3 py-2 text-xs text-emerald-300"
        >
          Limpar filtros
        </button>
      </section>
      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Resumo do recorte filtrado"
      >
        {[
          [rows.length.toLocaleString("pt-BR"), "contratos no filtro"],
          [
            grouped.length.toLocaleString("pt-BR"),
            "fornecedores por raiz de CNPJ",
          ],
          [contractMoney(total), "soma dos valores iniciais"],
        ].map(([v, l]) => (
          <div
            key={l}
            className="min-w-0 rounded-2xl border border-white/10 p-5"
          >
            <p className="break-words text-2xl font-semibold tracking-tight text-zinc-100">
              {v}
            </p>
            <p className="mt-2 text-xs text-zinc-400">{l}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-6 rounded-2xl border border-white/10 p-5 sm:p-6 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-300">
            Distribuição do recorte
          </p>
          <h2 className="mt-3 text-xl font-semibold">
            Quem aparece com os maiores valores?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Até cinco fornecedores, pela soma dos valores iniciais dos contratos
            filtrados. Um contrato pode durar vários anos. Os valores não medem
            pagamentos, concorrência ou qualidade.
          </p>
        </div>
        <ol className="space-y-5">
          {top.map((s) => (
            <li key={s.id}>
              <Link
                href={`/fornecedores/${s.id}`}
                className="block text-sm text-zinc-200 hover:text-emerald-300"
              >
                <span className="block break-words">{s.name}</span>
                <span className="mt-1 block text-xs text-zinc-400">
                  {contractMoney(s.total)} · {s.count} contrato(s)
                </span>
                <span className="mt-2 block h-2 rounded-full bg-white/5">
                  <span
                    className="block h-2 rounded-full bg-emerald-300/70"
                    style={{ width: `${(s.total / max) * 100}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
          {!top.length && (
            <li className="text-sm text-zinc-400">
              Nenhum resultado para estes filtros.
            </li>
          )}
        </ol>
      </section>
      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex rounded-xl border border-white/10 p-1"
            role="group"
            aria-label="Exibição"
          >
            {[
              ["contracts", "Contratos"],
              ["suppliers", "Fornecedores"],
            ].map(([v, l]) => (
              <button
                key={v}
                aria-pressed={filters.view === v}
                onClick={() => change("view", v)}
                className={`rounded-lg px-4 py-3 text-sm ${filters.view === v ? "bg-white/10 text-white" : "text-zinc-400"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            Publicações: {contractPeriod(data.period)}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {filters.view === "suppliers"
            ? grouped.slice(0, limit).map((s) => (
                <Link
                  key={s.id}
                  href={`/fornecedores/${s.id}`}
                  className="min-w-0 rounded-2xl border border-white/10 p-5 transition hover:border-emerald-300/40"
                >
                  <p className="text-xs text-emerald-300">
                    {[...s.states].join(" · ")} · {s.count} contrato(s)
                  </p>
                  <h3 className="mt-3 break-words font-medium">{s.name}</h3>
                  <p className="mt-4 text-xl text-zinc-100">
                    {contractMoney(s.total)}
                  </p>
                  <p className="mt-2 text-xs text-zinc-400">
                    {suppliers.get(s.id)!.connectionCount} perfil(is) com
                    conexão documental · Abrir fornecedor →
                  </p>
                </Link>
              ))
            : rows.slice(0, limit).map((c) => (
                <article
                  key={c.id}
                  className="min-w-0 rounded-2xl border border-white/10 p-5"
                >
                  <p className="text-xs text-emerald-300">
                    {c.uf} · Publicado em {contractDate(c.publishedAt)}
                  </p>
                  <Link
                    href={`/contratos/${c.id}`}
                    className="mt-3 block break-words font-medium hover:text-emerald-300"
                  >
                    {c.object.length > 180
                      ? `${c.object.slice(0, 180)}…`
                      : c.object}
                  </Link>
                  <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                    {c.agency}
                  </p>
                  <Link
                    className="mt-3 block break-words text-sm text-indigo-300 hover:underline"
                    href={`/fornecedores/${c.supplierId}`}
                  >
                    {c.supplierName}
                  </Link>
                  <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold">
                        {contractMoney(c.initialValue)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Valor inicial · contrato {c.number}/{c.year}
                      </p>
                    </div>
                    <Link
                      href={`/contratos/${c.id}`}
                      className="py-2 text-sm text-emerald-300"
                    >
                      Ver contrato →
                    </Link>
                  </div>
                </article>
              ))}
        </div>
        {(filters.view === "suppliers" ? grouped.length : rows.length) >
          limit && (
          <button
            onClick={() => setLimit((v) => v + 24)}
            className="mx-auto mt-6 block rounded-xl border border-white/20 px-6 py-3 text-sm"
          >
            Mostrar mais 24
          </button>
        )}
        {!rows.length && (
          <p className="py-10 text-center text-zinc-400">
            Nenhum contrato neste filtro. Tente outro termo ou limpe os filtros.
          </p>
        )}
      </section>
    </div>
  );
}
