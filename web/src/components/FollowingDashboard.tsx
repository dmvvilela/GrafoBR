"use client";
import Link from "next/link";
import { useState } from "react";
import type { ContractHistory } from "@/lib/state-contracts";
import { contractHistoryBaselines } from "@/lib/state-contracts";
import { eventMatches, unreadEvents } from "@/lib/contract-history";
import FollowButton, { useFollowing } from "./FollowButton";
import ContractEventList from "./ContractEventList";
export default function FollowingDashboard({
  history,
  suppliers,
}: {
  history: ContractHistory;
  suppliers: { id: string; name: string }[];
}) {
  const { items, ready, error, update } = useFollowing();
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const [limit, setLimit] = useState(30);
  const unread = unreadEvents(history.events, items, history.baselineVersion);
  const events = [
    ...(all
      ? history.events.filter((e) => items.some((f) => eventMatches(e, f.key)))
      : unread),
  ].reverse();
  const results =
    query.trim().length >= 2
      ? suppliers
          .filter((s) =>
            s.name
              .toLocaleLowerCase("pt-BR")
              .includes(query.trim().toLocaleLowerCase("pt-BR")),
          )
          .slice(0, 12)
      : [];
  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-white/10 p-5">
        <h2 className="text-xl font-semibold">Escolha o que acompanhar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["SP", "São Paulo"],
            ["MG", "Minas Gerais"],
            ["RJ", "Rio de Janeiro"],
            ["DF", "Distrito Federal"],
          ].map(([uf, name]) => (
            <div key={uf}>
              <Link
                className="mt-4 inline-block text-emerald-300"
                href={`/meu-estado/${uf.toLowerCase()}`}
              >
                {name} →
              </Link>
              <FollowButton
                target={`state:${uf}`}
                name={name}
                sequence={history.sequence}
                baseline={history.baselineVersion}
              />
            </div>
          ))}
        </div>
        <label className="mt-4 block text-sm" htmlFor="follow-search">
          Buscar fornecedor pelo nome
        </label>
        <input
          id="follow-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Digite pelo menos 2 letras"
          className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-zinc-950 p-3"
        />
        {query.trim().length >= 2 && (
          <p role="status" className="mt-3 text-xs text-zinc-400">
            {results.length
              ? `Até 12 resultados. Refine o nome para encontrar outros fornecedores.`
              : "Nenhum fornecedor encontrado neste recorte."}
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {results.map((s) => (
            <div
              key={s.id}
              className="min-w-0 rounded-xl border border-white/10 p-4"
            >
              <Link
                href={`/fornecedores/${s.id}`}
                className="break-words text-sm text-emerald-200"
              >
                {s.name} →
              </Link>
              <FollowButton
                target={`supplier:${s.id}`}
                name={s.name}
                sequence={history.sequence}
                baseline={history.baselineVersion}
              />
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold">
          Suas escolhas · {items.length}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Salvas apenas neste navegador. Limpar os dados do site apaga esta
          lista. Não há conta, sincronização entre dispositivos ou notificações
          em segundo plano.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-amber-200">
            {error}
          </p>
        )}
        {!ready && !error && (
          <p className="mt-3 text-zinc-400">Carregando suas escolhas…</p>
        )}
        {ready && !items.length && (
          <p className="mt-4 rounded-xl border border-white/10 p-5 text-zinc-400">
            Escolha SP, MG, RJ, DF ou um fornecedor para acompanhar as próximas
            mudanças.
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((f) => (
            <div
              key={f.key}
              className="min-w-0 rounded-xl border border-white/10 p-4"
            >
              <Link
                className="break-words font-medium text-emerald-200"
                href={
                  f.key.startsWith("state:")
                    ? `/meu-estado/${f.key.slice(6).toLowerCase()}`
                    : `/fornecedores/${f.key.slice(9)}`
                }
              >
                {suppliers.find((s) => `supplier:${s.id}` === f.key)?.name ??
                  f.name}{" "}
                →
              </Link>
              <FollowButton
                target={f.key}
                name={f.name}
                sequence={history.sequence}
                baseline={history.baselineVersion}
              />
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">
            O que mudou · {unread.length}{" "}
            {unread.length === 1 ? "nova" : "novas"}
          </h2>
          <button
            disabled={
              !ready ||
              (!unread.length &&
                !items.some(
                  (f) =>
                    f.baseline !== history.baselineVersion ||
                    f.seen > history.sequence,
                ))
            }
            onClick={() =>
              update((current) =>
                current.map((f) => ({
                  ...f,
                  seen: history.sequence,
                  baseline: history.baselineVersion,
                })),
              )
            }
            className="rounded-xl border border-white/20 px-4 py-3 text-sm disabled:opacity-40"
          >
            Marcar como visto
          </button>
        </div>
        <p className="text-sm text-zinc-400">
          Novidades contam a partir do momento em que você começa a acompanhar
          ou marca como visto. Início do histórico por UF: {contractHistoryBaselines(history).join(" ")}
        </p>
        {items.some(
          (f) =>
            f.baseline !== history.baselineVersion || f.seen > history.sequence,
        ) && (
          <p className="text-sm text-amber-200">
            A referência salva difere deste histórico. Consulte todo o histórico
            abaixo; marque como visto para usar esta referência nas próximas
            visitas.
          </p>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => {
              setAll(e.target.checked);
              setLimit(30);
            }}
          />
          Mostrar também mudanças já vistas e anteriores ao acompanhamento
        </label>
        {!events.length && (
          <p className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-6 text-sm text-zinc-300">
            {all
              ? "Nenhuma mudança observada para suas escolhas neste histórico."
              : "Nenhuma novidade para suas escolhas desde o último marco salvo. Volte após uma nova publicação dos dados."}
          </p>
        )}
        <ContractEventList events={events.slice(0, limit)} />
        {events.length > limit && (
          <button
            onClick={() => setLimit(limit + 30)}
            className="rounded-xl border border-white/20 px-4 py-3"
          >
            Ver mais mudanças
          </button>
        )}
        <Link
          href="/contratos/historico"
          className="inline-block py-3 text-emerald-300"
        >
          Ver histórico completo de SP, MG, RJ e DF →
        </Link>
      </section>
    </div>
  );
}
