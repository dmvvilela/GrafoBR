"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import ExportButton from "@/components/ExportButton";
import type { CeapTrail, EmendaTrail, Highlight } from "@/lib/data";

type RankingKind = "emendas" | "ceap" | "contratos";

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function Rank({ i }: { i: number }) {
  return (
    <span className="w-7 shrink-0 text-right text-xs font-medium text-zinc-600 tabular-nums">
      {i}
    </span>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "all" ? "Todos" : option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function RankingsExplorer({
  emendas,
  ceap,
  contracts,
}: {
  emendas: EmendaTrail[];
  ceap: CeapTrail[];
  contracts: Highlight[];
}) {
  const [kind, setKind] = useState<RankingKind>("emendas");
  const [uf, setUf] = useState("all");
  const [party, setParty] = useState("all");
  const ufs = useMemo(
    () => [
      "all",
      ...new Set([...emendas, ...contracts].map((item) => item.uf).filter(Boolean) as string[]),
    ].sort((a, b) => (a === "all" ? -1 : b === "all" ? 1 : a.localeCompare(b))),
    [emendas, contracts],
  );
  const parties = useMemo(
    () => [
      "all",
      ...new Set([...emendas, ...contracts].map((item) => item.party).filter(Boolean) as string[]),
    ].sort((a, b) => (a === "all" ? -1 : b === "all" ? 1 : a.localeCompare(b))),
    [emendas, contracts],
  );

  const filteredEmendas = emendas.filter(
    (item) =>
      (uf === "all" || item.uf === uf) &&
      (party === "all" || item.party === party),
  );
  const filteredContracts = contracts.filter(
    (item) =>
      (uf === "all" || item.uf === uf) &&
      (party === "all" || item.party === party),
  );
  const rows =
    kind === "emendas"
      ? filteredEmendas
      : kind === "contratos"
        ? filteredContracts
        : ceap;
  const exportRows = rows.map((row) => ({ ...row, ranking: kind }));

  return (
    <div className="space-y-5">
      <section className="grid gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Select
          label="Ranking"
          value={kind}
          options={["emendas", "ceap", "contratos"]}
          onChange={(value) => setKind(value as RankingKind)}
        />
        <Select label="UF" value={uf} options={ufs} onChange={setUf} />
        <Select label="Partido" value={party} options={parties} onChange={setParty} />
        <div className="flex items-end">
          <ExportButton
            filename={`rankings-${kind}.csv`}
            rows={exportRows}
            label="CSV"
          />
        </div>
      </section>

      {kind === "emendas" && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-purple-300">
              Emendas individuais
            </h2>
            <span className="text-xs text-zinc-500">
              {filteredEmendas.length} deputados · 2023–2025
            </span>
          </div>
          <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
            {filteredEmendas.map((e, i) => (
              <li key={e.id}>
                <Link
                  href={`/politico/${e.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/[0.03]"
                >
                  <Rank i={i + 1} />
                  <Avatar id={e.id} name={e.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-100">{e.name}</span>
                    <span className="text-xs text-zinc-500">
                      {e.party}
                      {e.uf ? ` · ${e.uf}` : ""}
                      {e.topArea ? ` · ${e.topArea}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold text-purple-300 tabular-nums">
                      {brl(e.empenhado)}
                    </span>
                    <span className="text-xs text-zinc-600 tabular-nums">
                      {brl(e.pago)} pago
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {kind === "ceap" && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-teal-300">
              Destinos da cota parlamentar (CEAP)
            </h2>
            <span className="text-xs text-zinc-500">fornecedores · 2025</span>
          </div>
          <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
            {ceap.map((c, i) => (
              <li key={c.supplier} className="flex items-center gap-3 px-3 py-2.5">
                <Rank i={i + 1} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-100" title={c.supplier}>
                    {c.supplier}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {c.category} · {c.deputies} deputados
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-teal-300 tabular-nums">
                  {brl(c.total)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {kind === "contratos" && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-amber-300">
              Empresas de deputados com contratos federais
            </h2>
            <span className="text-xs text-zinc-500">
              {filteredContracts.length} leads verificados
            </span>
          </div>
          <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
            {filteredContracts.map((h, i) => (
              <li key={`${h.id}-${h.company}`}>
                <Link
                  href={`/politico/${h.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/[0.03]"
                >
                  <Rank i={i + 1} />
                  <Avatar id={h.id} name={h.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-100">{h.name}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      sócio de {h.company}
                      {h.org ? ` · ${h.org}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-amber-300 tabular-nums">
                    {brl(h.value)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
