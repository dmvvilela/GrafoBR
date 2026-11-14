"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  composition,
  formatSpending,
  METRICS,
  spendingValue,
  spendingPath,
  UNITS,
  type SpendingSnapshot,
  type SpendingMetric,
} from "@/lib/state-spending";
import {
  contractDate,
  contractMoney,
  contractPeriod,
} from "@/lib/state-contracts";
import {
  DASHBOARD_STATES,
  dashboardPath,
  readDashboardSelection,
  type DashboardSelection,
  type DashboardSlug,
  type StateContractSummary,
} from "@/lib/state-dashboard";
import FollowButton from "./FollowButton";
import ContractFreshness from "./ContractFreshness";
import StateDashboardShare from "./StateDashboardShare";

const AREAS = ["10", "12", "06"] as const;
const COLORS = ["#6ee7b7", "#a5b4fc", "#fbbf24", "#71717a"];
const box =
  "min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7";
const select =
  "mt-2 w-full rounded-xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-100";
const number = (v: number) => v.toLocaleString("pt-BR");
const pct = (v: number | null) =>
  v == null
    ? "Sem base percentual"
    : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default function StateDashboard({
  slug,
  spending,
  contracts,
}: {
  slug: DashboardSlug;
  spending: SpendingSnapshot;
  contracts: StateContractSummary | null;
}) {
  const cv = contracts?.version ?? "unavailable";
  const [selection, setSelection] = useState<DashboardSelection>({
    year: Math.max(...spending.years),
    unit: "perCapita",
  });
  const [notice, setNotice] = useState("");
  useEffect(() => {
    function restore() {
      const value = readDashboardSelection(
        new URLSearchParams(location.search),
        spending.years,
        spending.version,
        cv,
      );
      setSelection(value.selection);
      setNotice(
        value.stale
          ? "Uma das bases foi revisada desde este compartilhamento. O painel mostra os dados atuais; um novo card usará estas versões."
          : value.corrected
            ? "Algumas opções do link não estavam disponíveis. Confira o ano e a medida selecionados."
            : "",
      );
    }
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [spending, cv]);
  const state = spending.states.find((s) => s.uf === slug.toUpperCase())!;
  const peer = spending.states.find((s) => s.uf !== state.uf)!;
  const record = state.records.find((r) => r.year === selection.year);
  const peerRecord = peer.records.find((r) => r.year === selection.year);
  const path = dashboardPath(slug, selection, spending.version, cv);
  function choose(patch: Partial<DashboardSelection>) {
    const next = { ...selection, ...patch };
    setSelection(next);
    setNotice("");
    window.history.pushState(
      null,
      "",
      dashboardPath(slug, next, spending.version, cv),
    );
  }
  const max = Math.max(
    1,
    ...AREAS.flatMap((metric) => [
      spendingValue(record, metric, selection.unit) ?? 0,
      spendingValue(peerRecord, metric, selection.unit) ?? 0,
    ]),
  );
  const distribution =
    record?.status === "available" ? composition(record) : null;
  const comparisonLink = spendingPath(
    {
      a: state.uf,
      b: peer.uf,
      year: selection.year,
      metric: "10",
      unit: selection.unit,
    },
    spending.version,
  );
  const contractFacts = contracts
    ? [
        `Publicações: ${contractPeriod(contracts.period)}.`,
        `${number(contracts.count)} contratos · ${number(contracts.supplierCount)} fornecedores.`,
        `${contractMoney(contracts.total)} em valores iniciais nominais; não são pagamentos.`,
        ...(contracts.leaders[0]
          ? [
              `Maior soma no recorte: ${contracts.leaders[0].name} (${pct(contracts.leaders[0].share)}).`,
            ]
          : []),
      ]
    : [
        "Base de contratos indisponível; ausência de informação não significa zero.",
      ];
  return (
    <div className="space-y-7">
      <header className="rounded-3xl border border-emerald-300/15 bg-[radial-gradient(ellipse_at_top_right,_rgba(16,185,129,0.12),_transparent_70%)] p-5 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/meu-estado"
            className="text-xs font-medium uppercase tracking-widest text-emerald-300"
          >
            ← Meu estado
          </Link>
          <nav aria-label="Escolher estado" className="flex gap-2">
            {(["sp", "mg"] as const).map((s) => (
              <Link
                key={s}
                aria-current={s === slug ? "page" : undefined}
                href={dashboardPath(s, selection, spending.version, cv)}
                className={`rounded-full border px-4 py-2 text-sm ${s === slug ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-200" : "border-white/15 text-zinc-400"}`}
              >
                {s.toUpperCase()}
              </Link>
            ))}
          </nav>
        </div>
        <h1 className="mt-7 text-4xl font-semibold tracking-tight sm:text-6xl">
          {state.name},<br />
          <span className="text-emerald-300">em perspectiva.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          Como o estado distribui suas despesas? Quais empresas aparecem nos
          contratos publicados? Explore os números e siga até a fonte.
        </p>
        <nav
          aria-label="Seções do painel"
          className="mt-7 flex flex-wrap gap-2"
        >
          {[
            ["gastos", "Gastos anuais"],
            ["fornecedores", "Fornecedores"],
            ["recentes", "Publicações recentes"],
            ["compartilhar", "Compartilhar"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-xl border border-white/15 px-3 py-3 text-xs text-zinc-300 hover:bg-white/5"
            >
              {label} ↓
            </a>
          ))}
        </nav>
      </header>
      {contracts && (
        <>
          <FollowButton
            target={`state:${slug.toUpperCase()}`}
            name={DASHBOARD_STATES[slug]}
            sequence={contracts.historySequence}
            baseline={contracts.historyBaseline}
          />
          <ContractFreshness
            fetchedAt={contracts.fetchedAt}
            refresh={contracts.refresh}
          />
        </>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-4 text-sm text-amber-200"
        >
          {notice}
        </p>
      )}
      <section id="gastos" className="space-y-5 scroll-mt-40">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-indigo-300">
              01 / Contas anuais · Siconfi + IBGE
            </p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
              As prioridades do gasto
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Exercícios completos. Despesas liquidadas, excluindo operações
              intraorçamentárias.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
            <label className="text-xs text-zinc-400">
              Ano das contas
              <select
                aria-label="Ano das contas"
                className={select}
                value={selection.year}
                onChange={(e) => choose({ year: Number(e.target.value) })}
              >
                {[...spending.years]
                  .sort((a, b) => b - a)
                  .map((y) => (
                    <option key={y}>{y}</option>
                  ))}
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Medida dos gastos
              <select
                aria-label="Medida dos gastos"
                className={select}
                value={selection.unit}
                onChange={(e) =>
                  choose({ unit: e.target.value as DashboardSelection["unit"] })
                }
              >
                {Object.entries(UNITS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [
              "Despesa total liquidada",
              formatSpending(
                spendingValue(record, "total", "total"),
                "total",
                true,
              ),
              `Exercício ${selection.year}`,
            ],
            [
              "Despesa por habitante",
              formatSpending(
                spendingValue(record, "total", "perCapita"),
                "perCapita",
              ),
              `População IBGE · julho/${selection.year}`,
            ],
            [
              "Investimentos",
              formatSpending(
                spendingValue(record, "investment", "total"),
                "total",
                true,
              ),
              "Categoria econômica; pode integrar as áreas abaixo",
            ],
          ].map(([label, value, detail]) => (
            <div key={label} className={box}>
              <p className="text-xs text-zinc-400">{label}</p>
              <p className="mt-3 break-words text-2xl font-semibold text-indigo-200">
                {value}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                {detail}
              </p>
            </div>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className={box}>
            <h3 className="text-lg font-semibold">
              Saúde, educação e segurança
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              {UNITS[selection.unit]} · {selection.year}. Todas as barras usam a
              mesma escala. {peer.name} oferece uma referência, não uma nota de
              desempenho.
            </p>
            <div className="mt-5 flex gap-4 text-xs">
              <span className="text-emerald-300">● {state.uf}</span>
              <span className="text-indigo-300">● {peer.uf}</span>
            </div>
            <div className="mt-5 space-y-6">
              {AREAS.map((metric) => (
                <div key={metric}>
                  <h4 className="text-sm font-medium">{METRICS[metric]}</h4>
                  {[
                    { state, record },
                    { state: peer, record: peerRecord },
                  ].map(({ state: s, record: r }, i) => {
                    const value = spendingValue(r, metric, selection.unit);
                    const uf = s.uf;
                    return (
                      <div key={uf} className="mt-3">
                        <div className="flex flex-wrap justify-between gap-2 text-xs">
                          <span
                            className={
                              i ? "text-indigo-300" : "text-emerald-300"
                            }
                          >
                            {uf}
                          </span>
                          <span className="tabular-nums">
                            {formatSpending(value, selection.unit)}
                          </span>
                        </div>
                        <div
                          aria-hidden="true"
                          className="mt-2 h-2 rounded-full bg-white/5"
                        >
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${((value ?? 0) / max) * 100}%`,
                              background: COLORS[i],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <Link
              href={comparisonLink}
              className="mt-6 inline-block py-2 text-sm text-emerald-300"
            >
              Abrir comparação completa →
            </Link>
          </section>
          <section className={box}>
            <h3 className="text-lg font-semibold">De cada R$ 100 de despesa</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Distribuição de {state.name} em {selection.year}. A base é a
              despesa total liquidada.
            </p>
            {distribution ? (
              <>
                <div
                  aria-hidden="true"
                  className="mt-7 flex h-10 overflow-hidden rounded-xl"
                >
                  {distribution.map((v, i) => (
                    <div
                      key={i}
                      style={{ width: `${v}%`, background: COLORS[i] }}
                    />
                  ))}
                </div>
                <dl className="mt-5 space-y-4">
                  {[
                    "Saúde",
                    "Educação",
                    "Segurança pública",
                    "Demais funções",
                  ].map((label, i) => (
                    <div
                      key={label}
                      className="flex justify-between gap-3 text-sm"
                    >
                      <dt>
                        <span style={{ color: COLORS[i] }}>● </span>
                        {label}
                      </dt>
                      <dd className="tabular-nums">{pct(distribution[i])}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="mt-5 text-sm text-zinc-400">
                Dados insuficientes para esta distribuição.
              </p>
            )}
            <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-zinc-500">
              Investimentos podem estar dentro de qualquer função. Por isso, não
              formam uma fatia adicional. Esses percentuais não são mínimos
              constitucionais.
            </p>
          </section>
        </div>
        <details className={box}>
          <summary className="cursor-pointer text-sm font-medium">
            Ver valores anuais de {state.name} · {spending.years.join(" e ")}
          </summary>
          <p className="mt-3 text-xs text-zinc-400">
            {UNITS[selection.unit]}. Valores nominais, sem correção pela
            inflação. Ausência de dados não é zero.
          </p>
          <p className="mt-3 text-xs text-zinc-500 sm:hidden">
            Deslize a tabela para ver os dois anos e os valores completos.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] table-fixed text-left text-xs sm:text-sm">
              <caption className="sr-only">Valores anuais por área</caption>
              <thead>
                <tr>
                  <th className="w-1/3 py-3">Área</th>
                  {spending.years.map((y) => (
                    <th key={y} className="px-2 text-right">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([...AREAS, "investment"] as SpendingMetric[]).map(
                  (metric) => (
                    <tr key={metric} className="border-t border-white/10">
                      <th className="break-words py-3 font-normal">
                        {METRICS[metric]}
                      </th>
                      {spending.years.map((y) => (
                        <td
                          key={y}
                          className="whitespace-nowrap px-2 text-right tabular-nums"
                        >
                          {formatSpending(
                            spendingValue(
                              state.records.find((r) => r.year === y),
                              metric,
                              selection.unit,
                            ),
                            selection.unit,
                          )}
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-relaxed text-amber-100">
        A partir daqui, a base é outra: contratos publicados no PNCP. Seus
        valores iniciais não representam pagamentos nem parcelas das contas
        anuais acima. Os totais não devem ser somados.
      </div>
      {contracts ? (
        <>
          <section id="fornecedores" className="space-y-5 scroll-mt-40">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-300">
                02 / Contratos e fornecedores · PNCP
              </p>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                Quem fornece para {state.name}?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Publicações de {contractPeriod(contracts.period)}. Este recorte
                inclui contratos iniciais de despesa com pessoas jurídicas, de
                todos os poderes estaduais; não é o estoque completo de
                contratos vigentes.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Contratos publicados", number(contracts.count)],
                ["Fornecedores distintos", number(contracts.supplierCount)],
                [
                  "Soma dos valores iniciais",
                  formatSpending(contracts.total, "total", true),
                ],
              ].map(([label, value]) => (
                <div key={label} className={box}>
                  <p className="text-xs text-zinc-400">{label}</p>
                  <p className="mt-3 break-words text-2xl font-semibold text-emerald-200">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <section className={box}>
              <div className="flex flex-wrap justify-between gap-3">
                <h3 className="text-lg font-semibold">
                  Maiores somas por fornecedor
                </h3>
                <span className="text-xs text-zinc-500">
                  Até 5 fornecedores · {state.uf}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                A barra mostra a participação na soma dos valores iniciais de
                todos os {number(contracts.count)} contratos deste estado no
                recorte. Matriz e filiais são agrupadas. Não mede participação
                de mercado, pagamentos ou concorrência.
              </p>
              <div className="mt-6 space-y-6">
                {contracts.leaders.map((supplier, i) => (
                  <Link
                    key={supplier.id}
                    href={`/fornecedores/${supplier.id}`}
                    className="group block"
                  >
                    <div className="flex items-start gap-3">
                      <span className="pt-1 text-xs text-zinc-500">
                        0{i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium group-hover:text-emerald-300">
                          {supplier.name} ↗
                        </p>
                        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-zinc-400">
                          <span>
                            {contractMoney(supplier.value)} ·{" "}
                            {number(supplier.count)} contrato(s)
                          </span>
                          <span className="text-emerald-300">
                            {pct(supplier.share)}
                          </span>
                        </div>
                        <div
                          aria-hidden="true"
                          className="mt-3 h-2 rounded-full bg-white/5"
                        >
                          <div
                            className="h-2 rounded-full bg-emerald-300"
                            style={{ width: `${supplier.share ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {contracts.count === 0 && (
                <p className="mt-4 text-sm text-zinc-400">
                  Nenhum contrato incluído neste recorte.
                </p>
              )}
              <Link
                href={`/contratos?uf=${state.uf}&view=suppliers`}
                className="mt-6 inline-block py-2 text-sm text-emerald-300"
              >
                Explorar todos os fornecedores e seus grafos →
              </Link>
              <p className="mt-2 text-xs text-zinc-500">
                O perfil de um fornecedor pode incluir contratos dos dois
                estados; os valores acima consideram apenas {state.uf}.
              </p>
            </section>
          </section>
          <section id="recentes" className="space-y-5 scroll-mt-40">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-300">
                03 / Publicações no período
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                O que entrou no PNCP?
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Data de publicação, que pode ser posterior à assinatura. Não é
                um feed em tempo real.
              </p>
            </div>
            <div className={box}>
              <h3 className="text-sm font-medium">
                Contratos publicados por dia · {state.uf}
              </h3>
              <p className="mt-2 text-xs text-zinc-400">
                Pico diário:{" "}
                {number(Math.max(0, ...contracts.days.map((d) => d.count)))}{" "}
                contratos. Cada barra representa um dia do recorte.
              </p>
              <div
                className="mt-5 flex h-28 items-end gap-px"
                aria-hidden="true"
              >
                {contracts.days.map((day) => (
                  <div
                    key={day.date}
                    className="min-w-0 flex-1 rounded-t-sm bg-indigo-300/80"
                    style={{
                      height: `${(day.count / Math.max(1, ...contracts.days.map((d) => d.count))) * 100}%`,
                    }}
                    title={`${contractDate(day.date)}: ${day.count}`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-zinc-500">
                <span>{contractDate(contracts.period.start)}</span>
                <span>{contractDate(contracts.period.end)}</span>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer py-2 text-xs text-indigo-200">
                  Ver contagem diária acessível
                </summary>
                <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-xs sm:grid-cols-3">
                  {contracts.days.map((d) => (
                    <div
                      key={d.date}
                      className="flex flex-wrap justify-between gap-1 border-b border-white/5 py-2"
                    >
                      <dt>{contractDate(d.date)}</dt>
                      <dd>{d.count}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </div>
            <ol className="grid gap-4 md:grid-cols-2">
              {contracts.recent.map((c) => (
                <li key={c.id} className={box}>
                  <p className="text-xs text-indigo-300">
                    Publicado em {contractDate(c.publishedAt)}
                  </p>
                  <Link
                    href={`/contratos/${c.id}`}
                    className="mt-3 block text-base font-medium leading-relaxed hover:text-emerald-300"
                  >
                    {c.object.length > 180
                      ? c.object.slice(0, 180) + "…"
                      : c.object}
                  </Link>
                  <p className="mt-3 break-words text-xs text-zinc-400">
                    {c.agency}
                  </p>
                  <Link
                    href={`/fornecedores/${c.supplierId}`}
                    className="mt-3 block break-words text-xs text-emerald-200"
                  >
                    {c.supplierName} ↗
                  </Link>
                  <p className="mt-4 break-words text-lg font-semibold">
                    {contractMoney(c.initialValue)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Valor inicial · contrato {c.number}/{c.year}
                  </p>
                  <Link
                    href={`/contratos/${c.id}`}
                    className="mt-4 inline-block py-2 text-xs text-emerald-300"
                  >
                    Ver contrato e fonte oficial →
                  </Link>
                </li>
              ))}
            </ol>
            <Link
              href={`/contratos?uf=${state.uf}&sort=date`}
              className="inline-block py-3 text-sm text-emerald-300"
            >
              Ver todas as publicações de {state.uf} →
            </Link>
          </section>
        </>
      ) : (
        <section id="fornecedores" className={box}>
          <h2 className="text-xl font-semibold">Contratos indisponíveis</h2>
          <p className="mt-3 text-sm text-zinc-400">
            A base deste estado aguarda uma importação validada. Ausência de
            informação não significa nenhum contrato.
          </p>
        </section>
      )}
      <StateDashboardShare
        key={path}
        name={state.name}
        path={path}
        disabled={record?.status !== "available"}
        spending={[
          `${selection.year} · ${UNITS[selection.unit]}`,
          ...AREAS.map(
            (metric) =>
              `${METRICS[metric]}: ${formatSpending(spendingValue(record, metric, selection.unit), selection.unit)}`,
          ),
          "Despesa liquidada, sem operações intraorçamentárias. Valores nominais.",
        ]}
        contracts={contractFacts}
        sources={[
          `Siconfi / Tesouro + população IBGE do mesmo ano. Consulta: ${contractDate(record?.fetchedAt ?? null)}.`,
          `PNCP: ${contracts ? `consulta em ${contractDate(contracts.fetchedAt)}` : "indisponível"}. Fontes e documentos no painel.`,
          `Versões: contas ${spending.version} · contratos ${cv}.`,
        ]}
      />
      <section id="fontes" className={box}>
        <h2 className="text-xl font-semibold">Fontes e limites do painel</h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-400">
          <p>
            As contas anuais consolidam os poderes do estado. Não são despesas
            pessoais do governador nem a soma dos gastos municipais e federais
            no território. Liquidação reconhece o direito do credor e não
            equivale necessariamente a pagamento. Mais gasto não significa
            melhor serviço.
          </p>
          <p>
            Por habitante usa a população estimada pelo IBGE para julho do mesmo
            exercício. Percentuais usam a despesa total liquidada como
            denominador. Os números são nominais, sujeitos a retificação e não
            incluem operações intraorçamentárias ou restos a pagar anteriores.
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            {record?.sourceUrls.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="py-2 text-emerald-300 underline"
              >
                Siconfi {state.uf}/{selection.year} · anexo I-
                {i === 0 ? "E" : "D"} ↗
              </a>
            ))}
            <a
              href={spending.populationSource.url}
              target="_blank"
              rel="noreferrer"
              className="py-2 text-emerald-300 underline"
            >
              População IBGE ↗
            </a>
            <a
              href="/data/_state-spending.json"
              className="py-2 text-emerald-300 underline"
            >
              Dados das contas anuais
            </a>
          </div>
          <p className="text-xs">
            Contas de {state.uf} consultadas em{" "}
            {contractDate(record?.fetchedAt ?? null)}. População consultada em{" "}
            {contractDate(spending.populationSource.fetchedAt)}. Essas datas não
            são datas de publicação original.
          </p>
          {contracts && (
            <>
              <p>
                PNCP: valores iniciais de contratos de despesa com fornecedores
                PJ. Não somamos aditivos, reajustes, empenhos ou receitas.
                Órgãos subrogados são excluídos. Um contrato pode abranger
                vários anos. Vínculos nos grafos remetem aos documentos
                existentes e não atribuem contratos pessoalmente ao governador.
              </p>
              <div className="flex flex-wrap gap-3 text-xs">
                <Link
                  href={`/contratos?uf=${state.uf}`}
                  className="py-2 text-emerald-300 underline"
                >
                  Ver cobertura e exclusões do PNCP
                </Link>
                <a
                  href="https://www.gov.br/pncp/pt-br/acesso-a-informacao/dados-abertos"
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 text-emerald-300 underline"
                >
                  PNCP · dados abertos ↗
                </a>
                <a
                  href="/data/_state-contracts.json"
                  className="py-2 text-emerald-300 underline"
                >
                  Dados dos contratos
                </a>
              </div>
              <p className="text-xs">
                PNCP consultado em {contractDate(contracts.fetchedAt)}.
                Publicações abrangidas: {contractPeriod(contracts.period)}. O
                seletor de ano das contas não altera este recorte.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
