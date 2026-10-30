"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EgoNetwork, GraphLink } from "@/lib/contract";
import type { IndexEntry } from "@/lib/data";
import { sharedConnections, comparisonPath, comparisonVersion, selectionForVersion } from "@/lib/comparison";
import { CONNECTION_LABELS, getCategoryColor } from "@/lib/graph-colors";
import { evidenceForConnection, sourceForConnection, sourceUrlForConnection } from "@/lib/evidence";
import Avatar from "@/components/Avatar";
import ComparisonShare, { connectionPeriod } from "@/components/ComparisonShare";

export interface ComparisonSuggestion { a: number; b: number; count: number }
type Pair = { a: string; b: string; entity: string | null; version: string | null };
type Loaded = { id: string; ego: EgoNetwork | null; status: "loading" | "ready" | "error" };

function useEgo(id: string, retry: number): Loaded {
  const [loaded, setLoaded] = useState<Loaded>({ id: "", ego: null, status: "loading" });
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoaded({ id, ego: null, status: "loading" });
    fetch(`/data/${id}.json`, { signal: controller.signal, cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Perfil indisponível");
        const ego = await response.json() as EgoNetwork;
        if (String(ego.meta?.egoId) !== id || !Array.isArray(ego.nodes) || !Array.isArray(ego.links)) throw new Error("Perfil inválido");
        if (!controller.signal.aborted) setLoaded({ id, ego, status: "ready" });
      })
      .catch(() => { if (!controller.signal.aborted) setLoaded({ id, ego: null, status: "error" }); });
    return () => controller.abort();
  }, [id, retry]);
  return loaded.id === id ? loaded : { id, ego: null, status: "loading" };
}

function Selector({ label, value, entries, onChange }: {
  label: string; value: string; entries: IndexEntry[]; onChange: (value: string) => void;
}) {
  return <label className="block min-w-0">
    <span className="text-xs font-medium text-zinc-400">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full min-w-0 rounded-xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 focus:ring-2 focus:ring-emerald-300">
      {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.party ?? "—"} · {entry.uf ?? "—"}</option>)}
    </select>
  </label>;
}

function Profile({ entry, side }: { entry: IndexEntry; side: "left" | "right" }) {
  return <Link href={`/politico/${entry.id}`} className={`flex min-w-0 flex-col items-center gap-3 rounded-2xl border p-4 text-center transition hover:bg-white/5 sm:p-6 ${side === "left" ? "border-indigo-300/20 bg-indigo-400/5" : "border-teal-300/20 bg-teal-400/5"}`}>
    <Avatar key={entry.id} id={entry.id} name={entry.name} size={64} />
    <span className="text-sm font-semibold text-zinc-100 sm:text-base">{entry.name}</span>
    <span className="text-xs text-zinc-400">{entry.party ?? "—"} · {entry.uf ?? "—"}</span>
    <span className="text-xs text-emerald-300">Ver perfil ↗</span>
  </Link>;
}

function Evidence({ ego, links }: { ego: EgoNetwork; links: GraphLink[] }) {
  return <div className="min-w-0 space-y-4 rounded-xl border border-white/10 bg-black/15 p-4">
    <h4 className="font-medium text-zinc-100">{ego.meta.egoName}</h4>
    {links.map((link) => {
      const evidence = evidenceForConnection(link.connectionType);
      const url = sourceUrlForConnection(link.connectionType);
      return <div key={link.id} className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-2"><span className="text-emerald-200">{CONNECTION_LABELS[link.connectionType]}</span><span className={`rounded px-1.5 py-0.5 text-[10px] ring-1 ${evidence.className}`}>{evidence.label}</span></div>
        <p className="break-words leading-relaxed text-zinc-300">{link.description || "Descrição não disponível neste registro."}</p>
        <p className="text-xs leading-relaxed text-zinc-500">{evidence.detail}</p>
        <p className="text-xs text-zinc-400">{connectionPeriod(ego, link)}</p>
        {url && <a href={url} target="_blank" rel="noreferrer" className="block text-xs text-emerald-300 hover:underline">{sourceForConnection(link.connectionType)} ↗</a>}
        <Link href={`/investigar/${ego.meta.egoId}`} className="block text-xs text-zinc-400 underline">Examinar registros deste perfil</Link>
      </div>;
    })}
  </div>;
}

export default function ComparePoliticians({ entries, suggestions }: { entries: IndexEntry[]; suggestions: ComparisonSuggestion[] }) {
  const first = suggestions[0];
  const [pair, setPair] = useState<Pair>({ a: String(first?.a ?? entries[0]?.id ?? ""), b: String(first?.b ?? entries[1]?.id ?? ""), entity: null, version: null });
  const [initialized, setInitialized] = useState(false);
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [limit, setLimit] = useState(6);
  useEffect(() => {
    function readUrl() {
      const query = new URLSearchParams(window.location.search);
      const valid = (id: string | null) => entries.some((entry) => String(entry.id) === id);
      setPair({ a: valid(query.get("a")) ? query.get("a")! : String(first?.a ?? entries[0]?.id ?? ""), b: valid(query.get("b")) ? query.get("b")! : String(first?.b ?? entries[1]?.id ?? ""), entity: query.get("entity"), version: query.get("v") });
      setNotice((query.has("a") && !valid(query.get("a"))) || (query.has("b") && !valid(query.get("b"))) ? "Um perfil do link não está disponível nesta versão. Exibimos uma sugestão válida." : "");
      setInitialized(true);
    }
    readUrl();
    window.addEventListener("popstate", readUrl);
    return () => window.removeEventListener("popstate", readUrl);
  }, [entries, first]);

  const left = useEgo(initialized ? pair.a : "", retry);
  const right = useEgo(initialized ? pair.b : "", retry);
  const a = left.ego; const b = right.ego;
  const shared = useMemo(() => a && b ? sharedConnections(a, b) : [], [a, b]);
  const version = a && b ? comparisonVersion(a, b) : "";
  const restored = selectionForVersion(shared, pair.entity, pair.version, version);
  const staleSelection = !!pair.entity && !!version && !restored;
  const selected = shared.find((item) => item.entityId === restored) ?? (!staleSelection ? shared[0] : undefined);
  const entryA = entries.find((entry) => String(entry.id) === pair.a);
  const entryB = entries.find((entry) => String(entry.id) === pair.b);
  const path = comparisonPath(pair.a, pair.b, selected?.entityId, version);
  useEffect(() => {
    // Preserve the original shared selection while files load, including an
    // obsolete version that must remain visibly obsolete after another reload.
    if (initialized && a && b && !staleSelection) window.history.replaceState(null, "", path);
  }, [initialized, a, b, staleSelection, path]);
  function choose(a: string, b: string) { setPair({ a, b, entity: null, version: null }); setLimit(6); setNotice(""); }
  const types = ["doacao", "despesa", "socio", "contrato", "emenda"] as const;
  const label = (links: GraphLink[]) => [...new Set(links.map((link) => CONNECTION_LABELS[link.connectionType]))].join(" · ");
  const visible = shared.slice(0, limit);
  if (selected && !visible.includes(selected)) visible.push(selected);

  return <div className="space-y-6">
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector label="Parlamentar A" value={pair.a} entries={entries} onChange={(value) => choose(value, pair.b)} />
        <Selector label="Parlamentar B" value={pair.b} entries={entries} onChange={(value) => choose(pair.a, value)} />
      </div>
      {!!suggestions.length && <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Experimente:</span>
        {suggestions.map((item) => <button key={`${item.a}-${item.b}`} onClick={() => choose(String(item.a), String(item.b))} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-emerald-300/40 hover:text-emerald-200">
          {entries.find((entry) => entry.id === item.a)?.name} + {entries.find((entry) => entry.id === item.b)?.name}
        </button>)}
        <span className="text-[11px] text-zinc-500">Exemplos com registros em comum, sem ordem de relevância.</span>
      </div>}
    </section>
    {notice && <p role="status" className="rounded-xl bg-amber-400/10 p-4 text-sm text-amber-200">{notice}</p>}
    {pair.a === pair.b ? <p role="status" className="rounded-2xl border border-white/10 p-8 text-center text-zinc-300">Escolha dois parlamentares diferentes para explorar conexões em comum.</p>
      : left.status === "error" || right.status === "error" ? <div role="alert" className="rounded-2xl border border-amber-300/20 p-8 text-center"><p>Não foi possível carregar os dois perfis. Isso não significa ausência de conexões.</p><button onClick={() => setRetry((n) => n + 1)} className="mt-3 text-emerald-300 underline">Tentar novamente</button></div>
      : !a || !b || !entryA || !entryB ? <p role="status" className="rounded-2xl border border-white/10 p-12 text-center text-zinc-400">Carregando os registros dos dois perfis…</p>
      : <>
        <section aria-label="Mapa de conexões em comum" className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_70%)] p-4 sm:p-7">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-medium uppercase tracking-widest text-emerald-300">Explore a interseção</p><h2 className="mt-2 text-xl font-semibold text-zinc-100">{shared.length} {shared.length === 1 ? "entidade em comum" : "entidades em comum"}</h2></div>
            <p className="max-w-sm text-xs leading-relaxed text-zinc-400">Cada ligação leva a um registro. Compartilhar um fornecedor ou doador não demonstra relação direta entre os parlamentares.</p>
          </div>
          <div className="relative grid grid-cols-2 items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)_minmax(0,1fr)] md:gap-8">
            {!!shared.length && <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 1000 400" preserveAspectRatio="none"><defs><linearGradient id="comparison-wire"><stop stopColor="#818cf8" /><stop offset="1" stopColor="#2dd4bf" /></linearGradient></defs><path d="M 130 85 C 290 85 270 200 380 200 M 620 200 C 730 200 710 85 870 85" fill="none" stroke="url(#comparison-wire)" strokeWidth="2" opacity=".6" vectorEffect="non-scaling-stroke" /></svg>}
            <div className="relative z-10"><Profile entry={entryA} side="left" /></div>
            <div className="relative z-10 col-span-2 row-start-2 space-y-2 md:col-span-1 md:col-start-2 md:row-start-1">
              {!shared.length && <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-zinc-400">Nenhuma entidade em comum identificada neste recorte. Os arquivos são limitados; isso não prova ausência de outras conexões.</div>}
              {visible.map((item) => <button key={item.entityId} aria-pressed={selected?.entityId === item.entityId} onClick={() => setPair({ ...pair, entity: item.entityId, version })} className={`w-full rounded-xl border p-4 text-left transition motion-reduce:transition-none ${selected?.entityId === item.entityId ? "border-emerald-300/60 bg-[#152c2a] shadow-lg shadow-emerald-950/30" : "border-white/10 bg-[#131722] hover:border-white/30"}`}>
                <span className="mb-2 flex items-center gap-2 text-[11px] text-zinc-400"><span className="h-2 w-2 rounded-full" style={{ background: getCategoryColor(item.left.category) }} />{label(item.leftLinks)} <span aria-hidden="true">↔</span> {label(item.rightLinks)}</span>
                <span className="block break-words text-sm font-medium text-zinc-100">{item.left.name}</span>
                {item.left.name !== item.right.name && <span className="mt-1 block text-xs text-zinc-400">No outro perfil: {item.right.name}</span>}
                <span className="mt-2 block text-xs text-emerald-300">{selected?.entityId === item.entityId ? "Conexão selecionada ↓" : "Ver registros e compartilhar →"}</span>
              </button>)}
              {shared.length > limit && <button onClick={() => setLimit(shared.length)} className="w-full py-3 text-xs text-emerald-300">Mostrar todas as {shared.length} entidades</button>}
            </div>
            <div className="relative z-10 col-start-2 row-start-1 md:col-start-3"><Profile entry={entryB} side="right" /></div>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-zinc-500">Correspondência por identificador da entidade nos dados, nunca apenas pelo nome. O recorte não inclui todos os registros de cada parlamentar.</p>
        </section>
        {staleSelection && <p role="status" className="rounded-xl bg-amber-400/10 p-4 text-sm text-amber-200">Os dados ou a conexão deste link mudaram. Selecione uma entidade acima para consultar a versão disponível; a seleção antiga não foi aplicada automaticamente.</p>}
        {selected && <section aria-label="Registros da conexão selecionada" className="space-y-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.025] p-4 sm:p-6">
          <div><p className="text-xs uppercase tracking-widest text-emerald-300">Os registros por trás da conexão</p><h3 className="mt-2 break-words text-lg font-semibold text-zinc-100">{selected.left.name}</h3></div>
          <div className="grid gap-4 md:grid-cols-2"><Evidence ego={a} links={selected.leftLinks} /><Evidence ego={b} links={selected.rightLinks} /></div>
          <ComparisonShare key={`${pair.a}-${pair.b}-${selected.entityId}`} a={a} b={b} connection={selected} path={path} />
        </section>}
        <details className="rounded-2xl border border-white/10 p-4 sm:p-6">
          <summary className="cursor-pointer text-sm font-medium text-zinc-300">Comparar cobertura e quantidade de vínculos</summary>
          <p className="mt-3 text-xs text-zinc-500">Contagens dos arquivos limitados, não totais de atividade. Coberturas diferentes não permitem classificar desempenho.</p>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs sm:text-sm"><thead><tr className="text-zinc-400"><th className="py-3">Tipo</th><th className="px-2 text-right">{a.meta.egoName}</th><th className="text-right">{b.meta.egoName}</th></tr></thead><tbody className="divide-y divide-white/5">{types.map((type) => <tr key={type}><td className="py-3 text-zinc-300">{CONNECTION_LABELS[type]}</td><td className="px-2 text-right text-zinc-400">{a.links.filter((link) => link.connectionType === type).length}</td><td className="text-right text-zinc-400">{b.links.filter((link) => link.connectionType === type).length}</td></tr>)}</tbody></table></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">{[a, b].map((ego) => <div key={ego.meta.egoId} className="text-xs text-zinc-400"><p className="mb-2 font-medium text-zinc-200">{ego.meta.egoName}</p>{Object.entries(ego.meta.sourceCoverage).map(([source, coverage]) => <p key={source} className="mb-2">{coverage}</p>)}</div>)}</div>
        </details>
      </>}
  </div>;
}
