"use client";
import { useState } from "react";
import type { ContractEvent } from "@/lib/state-contracts";
import ContractEventList from "./ContractEventList";
import { eventMatches } from "@/lib/contract-history";
export default function ContractHistoryFeed({
  events,
}: {
  events: ContractEvent[];
}) {
  const [uf, setUf] = useState("");
  const [kind, setKind] = useState("");
  const [limit, setLimit] = useState(30);
  const selected = [...events]
    .reverse()
    .filter(
      (e) =>
        (!uf || eventMatches(e, `state:${uf}`)) && (!kind || e.kind === kind),
    );
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Estado
          <select
            value={uf}
            onChange={(e) => {
              setUf(e.target.value);
              setLimit(30);
            }}
            className="ml-2 rounded-lg border border-white/20 bg-zinc-950 p-3"
          >
            <option value="">SP + MG + RJ + DF</option>
            <option>SP</option>
            <option>MG</option>
            <option>RJ</option>
            <option>DF</option>
          </select>
        </label>
        <label className="text-sm">
          Mudança
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setLimit(30);
            }}
            className="ml-2 rounded-lg border border-white/20 bg-zinc-950 p-3"
          >
            <option value="">Todas</option>
            <option value="added">Entradas</option>
            <option value="changed">Alterações</option>
            <option value="removed">Não retornou</option>
          </select>
        </label>
      </div>
      <p role="status" className="text-sm text-zinc-400">
        {selected.length} mudanças observadas neste filtro.
      </p>
      {!selected.length && (
        <p className="rounded-2xl border border-white/10 p-6 text-zinc-400">
          Nenhuma mudança observada neste filtro. O primeiro retrato estabelece
          a referência; não transforma contratos antigos em novidades.
        </p>
      )}
      <ContractEventList events={selected.slice(0, limit)} />
      {selected.length > limit && (
        <button
          onClick={() => setLimit(limit + 30)}
          className="rounded-xl border border-white/20 px-5 py-3"
        >
          Ver mais mudanças
        </button>
      )}
    </section>
  );
}
