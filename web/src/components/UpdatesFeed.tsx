"use client";

import { useState } from "react";
import Link from "next/link";
import type { UpdatesHistory } from "@/lib/data";
import { formatSnapshotDate } from "@/lib/freshness";

const labels: Record<string, string> = {
  doacao: "Doações",
  socio: "Sociedades",
  contrato: "Contratos",
  despesa: "Cota parlamentar",
  emenda: "Emendas",
  obra: "Obras",
  candidatura: "Eleições",
};
const modes = {
  added: "Entrou no recorte",
  changed: "Registro alterado",
  removed: "Saiu do recorte",
};
export default function UpdatesFeed({
  history,
  preview = false,
}: {
  history: UpdatesHistory | null;
  preview?: boolean;
}) {
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(40);
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const batches = (history?.batches ?? [])
    .map((batch) => ({
      ...batch,
      events: batch.events.filter(
        (e) =>
          (!kind || e.kind === kind) &&
          normalize(`${e.title} ${e.context}`).includes(normalize(query)),
      ),
    }))
    .filter((batch) => batch.events.length);
  const total = batches.reduce((sum, batch) => sum + batch.events.length, 0);
  let remaining = limit;
  const visible = preview
    ? batches.slice(0, 1)
    : batches
        .map((batch) => {
          const events = batch.events.slice(0, remaining);
          remaining -= events.length;
          return { ...batch, events };
        })
        .filter((batch) => batch.events.length);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-zinc-100">
          O que mudou nos dados
        </h2>
        {preview && (
          <Link
            href="/atualizacoes"
            className="text-sm text-emerald-300 hover:underline"
          >
            Ver histórico →
          </Link>
        )}
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
        Mudanças observadas entre versões. A data abaixo é a da comparação, não
        a do acontecimento. Entrar ou sair do recorte não comprova início ou fim
        de um vínculo.
      </p>
      {!preview && (
        <div className="flex flex-wrap gap-3">
          <label className="flex-1 text-xs text-zinc-400">
            Buscar no histórico
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, partido ou estado"
              className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100"
            />
          </label>
          <label className="text-xs text-zinc-400">
            Tipo de registro
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="mt-1 block rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100"
            >
              <option value="">Todos os tipos</option>
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {!visible.length && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm leading-relaxed text-zinc-400">
          {kind || query
            ? "Nenhuma mudança corresponde aos filtros."
            : history?.batches.length
              ? `Linha de base registrada em ${formatSnapshotDate(history.batches.at(-1)?.observedAt)}. Ainda não há diferenças registradas. A próxima comparação com dados diferentes aparecerá aqui.`
              : "O histórico ainda não está disponível nesta versão."}
        </div>
      )}
      {visible.map((batch) => (
        <div key={batch.id} className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Observado em {formatSnapshotDate(batch.observedAt)}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(preview ? batch.events.slice(0, 4) : batch.events).map(
              (event) => (
                <Link
                  key={event.key}
                  href={event.href}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-emerald-400/30"
                >
                  <span className="text-[11px] text-emerald-300">
                    {modes[event.mode]}
                  </span>
                  <h4 className="mt-1 text-sm font-medium text-zinc-100">
                    {event.title}
                  </h4>
                  <p className="mt-1 text-xs text-zinc-500">{event.context}</p>
                  {event.kind !== "obra" && event.kind !== "candidatura" && (
                    <p className="mt-2 text-xs text-zinc-400">
                      {event.previousCount ?? 0} →{" "}
                      {event.mode === "removed" ? 0 : event.count} vínculos no
                      recorte
                    </p>
                  )}
                </Link>
              ),
            )}
          </div>
        </div>
      ))}
      {!preview && total > limit && (
        <button
          onClick={() => setLimit(limit + 40)}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-emerald-300 hover:bg-white/5"
        >
          Mostrar mais mudanças
        </button>
      )}
      {!preview && (
        <p className="text-xs text-zinc-500">
          Até 30 comparações mantidas. Mudanças de cobertura e correções de
          identificação também podem alterar os registros. Conexões não são
          acusações.
        </p>
      )}
    </section>
  );
}
