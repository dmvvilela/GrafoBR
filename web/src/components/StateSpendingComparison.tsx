"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StateSpendingShare from "./StateSpendingShare";
import { composition, formatSpending, FUNCTION_NAMES, METRICS, readSpendingSelection, spendingAmount, spendingPath, spendingValue, UNITS, type SpendingMetric, type SpendingRecord, type SpendingSelection, type SpendingSnapshot, type SpendingState, type SpendingUnit } from "@/lib/state-spending";

const COLORS = ["#a5b4fc", "#5eead4"];
const COMPOSITION_COLORS = ["#34d399", "#818cf8", "#fbbf24", "#52525b"];
const date = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const selectClass = "mt-2 w-full min-w-0 rounded-xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-300";

function Trend({ states, data, selection }: { states: SpendingState[]; data: SpendingSnapshot; selection: SpendingSelection }) {
  const series = states.map(s => data.years.map(year => spendingValue(s.records.find(r=>r.year===year), selection.metric,selection.unit)));
  const max = Math.max(1, ...series.flat().filter((v): v is number=>v!=null));
  const x = (i: number) => 125+i*350/Math.max(1,data.years.length-1);
  const y = (v: number) => 210-(v/max)*150;
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
    <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Evolução anual</p>
    <h2 className="mt-2 text-xl font-semibold">{METRICS[selection.metric]} ao longo do tempo</h2>
    <p className="mt-2 text-xs leading-relaxed text-zinc-400">{UNITS[selection.unit]} · {data.years.join(" e ")}. Valores nominais, sem correção pela inflação. A linha conecta dois totais anuais.</p>
    <svg role="img" aria-label={`Evolução de ${METRICS[selection.metric]} em ${UNITS[selection.unit]}: valores detalhados na tabela abaixo`} className="mt-4 h-auto w-full" viewBox="0 0 520 260">
      {[0,.5,1].map(f=><g key={f}><line x1="120" x2="485" y1={y(max*f)} y2={y(max*f)} stroke="#ffffff15" strokeDasharray={f?"4 6":undefined}/><text x="110" y={y(max*f)+5} fill="#a1a1aa" fontSize="22" textAnchor="end">{formatSpending(max*f,selection.unit,true)}</text></g>)}
      {data.years.map((year,i)=><text key={year} x={x(i)} y="246" textAnchor="middle" fill="#a1a1aa" fontSize="24">{year}</text>)}
      {series.map((values,s)=><g key={states[s].uf}>{values.map((value,i)=>value==null?null:<g key={i}>{i>0 && values[i-1]!=null && <line x1={x(i-1)} y1={y(values[i-1]!)} x2={x(i)} y2={y(value)} stroke={COLORS[s]} strokeWidth="3"/>}<circle cx={x(i)} cy={y(value)} r="6" fill={COLORS[s]}><title>{`${states[s].name}, ${data.years[i]}: ${formatSpending(value,selection.unit)}`}</title></circle></g>)}</g>)}
    </svg>
    <div className="mt-2 flex flex-wrap gap-4 text-xs">{states.map((s,i)=><span key={s.uf} style={{color:COLORS[i]}}>● {s.name}</span>)}</div>
    <table className="mt-4 w-full table-fixed text-left text-xs sm:text-sm"><caption className="sr-only">Valores anuais de {METRICS[selection.metric]} em {UNITS[selection.unit]}</caption><thead><tr><th className="w-14 py-3 text-zinc-400">Ano</th>{states.map(s=><th key={s.uf} className="break-words px-2 text-right font-medium">{s.name}</th>)}</tr></thead><tbody>{data.years.map((year,i)=><tr key={year} className="border-t border-white/5"><th className="py-3 font-normal text-zinc-400">{year}</th>{series.map((values,j)=><td key={j} className="break-words px-2 text-right tabular-nums" style={{color:COLORS[j]}}>{formatSpending(values[i],selection.unit)}</td>)}</tr>)}</tbody></table>
  </section>;
}

function Composition({ states, records }: { states: SpendingState[]; records: (SpendingRecord|undefined)[] }) {
  return <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
    <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Distribuição por área</p>
    <h2 className="mt-2 text-xl font-semibold">De cada R$ 100 de despesa</h2>
    <p className="mt-2 text-xs leading-relaxed text-zinc-400">Participação no total liquidado, excluindo operações dentro do próprio orçamento.</p>
    <div className="mt-6 space-y-7">{states.map((s,i)=>{
      const values=composition(records[i]);return <div key={s.uf}><h3 className="text-sm font-medium" style={{color:COLORS[i]}}>{s.name}</h3>{values?<><div aria-hidden="true" className="mt-3 flex h-6 overflow-hidden rounded-lg">{values.map((value,j)=><div key={j} style={{width:`${value}%`,background:COMPOSITION_COLORS[j]}}/>)}</div><dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">{["Saúde","Educação","Segurança","Demais funções"].map((label,j)=><div key={label} className="min-w-0"><dt className="text-zinc-400"><span style={{color:COMPOSITION_COLORS[j]}}>●</span> {label}</dt><dd className="mt-1 tabular-nums">{values[j].toLocaleString("pt-BR",{maximumFractionDigits:1})}%</dd></div>)}</dl></>:<p className="mt-3 text-sm text-zinc-400">Dados insuficientes para esta distribuição.</p>}</div>;
    })}</div>
    <p className="mt-6 text-xs leading-relaxed text-zinc-500">Investimentos são uma classificação diferente: podem estar dentro de qualquer área e não são somados a esta distribuição.</p>
  </section>;
}

export default function StateSpendingComparison({data, governors}: {data: SpendingSnapshot; governors: {uf:string;id:number;name:string;verifiedAt:string}[]}) {
  const [selection,setSelection]=useState<SpendingSelection>(()=>readSpendingSelection(new URLSearchParams(),data).selection);
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    function restore(){const parsed=readSpendingSelection(new URLSearchParams(window.location.search),data);setSelection(parsed.selection);setNotice(parsed.stale?"A base foi revisada desde a criação deste link. Os gráficos mostram a versão atual; um novo card usará esta versão.":parsed.corrected?"Algumas opções do link não estavam disponíveis e foram ajustadas. Confira os filtros abaixo.":"");}
    restore();window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);
  },[data]);
  function choose(patch:Partial<SpendingSelection>){const next={...selection,...patch};setSelection(next);setNotice("");window.history.pushState(null,"",spendingPath(next,data.version));}
  const states=[selection.a,selection.b].map(uf=>data.states.find(s=>s.uf===uf)!);
  const records=states.map(s=>s.records.find(r=>r.year===selection.year));
  const values=records.map(r=>spendingValue(r,selection.metric,selection.unit));
  const max=Math.max(...values.map(v=>v??0),1);
  const same=selection.a===selection.b;
  const options=[...data.states].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
  const hasDF=states.some(s=>s.uf==="DF");
  return <div className="space-y-6">
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-6" aria-label="Filtros da comparação">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_120px]">
        {(["a","b"] as const).map((key,i)=><label key={key} className="min-w-0 text-xs text-zinc-400">Estado {i===0?"A":"B"}<select value={selection[key]} onChange={e=>choose({[key]:e.target.value})} className={selectClass}>{options.map(s=><option key={s.uf} value={s.uf}>{s.name} · {s.uf}</option>)}</select></label>)}
        <label className="min-w-0 text-xs text-zinc-400">Ano completo<select className={selectClass} value={selection.year} onChange={e=>choose({year:Number(e.target.value)})}>{[...data.years].reverse().map(year=><option key={year}>{year}</option>)}</select></label>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="min-w-0 text-xs text-zinc-400">Área ou categoria<select className={selectClass} value={selection.metric} onChange={e=>choose({metric:e.target.value as SpendingMetric})}>{Object.entries(METRICS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label className="min-w-0 text-xs text-zinc-400">Como comparar<select className={selectClass} value={selection.unit} onChange={e=>choose({unit:e.target.value as SpendingUnit})}>{Object.entries(UNITS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
      <p className="mt-4 text-xs leading-relaxed text-zinc-500">Por habitante considera o tamanho da população. A participação mostra a distribuição do gasto. Nenhuma medida isolada avalia eficiência ou qualidade dos serviços.</p>
    </section>
    {notice&&<p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-200">{notice}</p>}
    {same?<p role="status" className="rounded-2xl border border-white/10 p-8 text-center text-zinc-300">Escolha dois estados diferentes para comparar.</p>:<>
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_70%)] p-5 sm:p-8" aria-label="Comparação principal">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-widest text-emerald-300">{selection.year} · ano completo</p><h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{METRICS[selection.metric]}</h2></div><span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400">{UNITS[selection.unit]}</span></div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">Despesa liquidada: obrigação reconhecida após verificar o direito do credor. Não equivale necessariamente ao valor já pago.</p>
        {selection.metric==="investment"&&<p className="mt-3 text-xs text-amber-200">Investimentos (categoria econômica): obras, instalações e equipamentos, entre outros. Podem integrar saúde, educação e segurança.</p>}
        <div className="mt-7 grid gap-6 sm:grid-cols-2">{states.map((s,i)=><article key={s.uf} className="min-w-0 rounded-2xl border border-white/10 bg-black/15 p-4 sm:p-5"><p className="text-sm font-medium" style={{color:COLORS[i]}}>{s.name} <span className="opacity-60">· {s.uf}</span></p><p className="mt-3 break-words text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">{formatSpending(values[i],selection.unit,selection.unit==="total")}</p><div aria-hidden="true" className="mt-5 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none" style={{width:`${(values[i]??0)/max*100}%`,background:COLORS[i]}}/></div><dl className="mt-5 space-y-3 text-xs"><div><dt className="text-zinc-500">Total {selection.metric==="total"?"do estado":"da área/categoria"}</dt><dd className="mt-1 break-words text-zinc-300">{formatSpending(spendingAmount(records[i],selection.metric),"total")}</dd></div><div><dt className="text-zinc-500">População estimada · julho/{selection.year}</dt><dd className="mt-1 text-zinc-300">{records[i]?.population.toLocaleString("pt-BR")??"Sem dados"} habitantes</dd></div><div><dt className="text-zinc-500">Participação na despesa total</dt><dd className="mt-1 text-zinc-300">{formatSpending(spendingValue(records[i],selection.metric,"share"),"share")}</dd></div></dl>{values[i]==null&&<p className="mt-4 text-xs text-amber-200">Registro indisponível nesta fonte. Ausência de informação não significa gasto zero.</p>}</article>)}</div>
        <p className="mt-5 text-xs leading-relaxed text-zinc-500">Mesma medida, mesmo ano e escala comum nas duas barras. Valores em reais nominais, sem operações intraorçamentárias.</p>
      </section>
      {hasDF&&<p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-relaxed text-amber-200">O Distrito Federal acumula competências estaduais e municipais. O financiamento federal de serviços, inclusive pelo Fundo Constitucional, afeta a comparação; esta base não representa todo o gasto público realizado no território.</p>}
      <div className="grid items-start gap-6 lg:grid-cols-2"><Trend states={states} data={data} selection={selection}/><Composition states={states} records={records}/></div>
      <StateSpendingShare key={spendingPath(selection,data.version)} data={data} selection={selection}/>
      <details className="rounded-2xl border border-white/10 p-5 sm:p-6"><summary className="cursor-pointer text-sm font-medium text-zinc-200">Ver todas as funções e valores exatos de {selection.year}</summary><p className="mt-3 text-xs text-zinc-400">Despesas liquidadas em R$. “Sem linha” significa que a função não veio na resposta da fonte; não é tratado como zero.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs"><caption className="sr-only">Funções da despesa em {selection.year}</caption><thead><tr><th className="py-3">Função</th>{states.map(s=><th key={s.uf} className="px-3 text-right">{s.name}</th>)}</tr></thead><tbody>{Array.from(new Set(records.flatMap(r=>Object.keys(r?.functions??{})))).sort().map(code=><tr key={code} className="border-t border-white/5"><th className="py-3 font-normal text-zinc-400">{FUNCTION_NAMES[code]??code}</th>{records.map((r,i)=><td key={i} className="px-3 text-right tabular-nums">{r?.functions[code]==null?"Sem linha":formatSpending(r.functions[code],"total")}</td>)}</tr>)}</tbody></table></div></details>
    </>}
    <section id="metodologia" className="space-y-4 rounded-2xl border border-white/10 p-5 text-sm leading-relaxed text-zinc-400 sm:p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Como ler estes dados</h2>
      <p>São contas consolidadas do estado/DF, incluindo seus poderes e órgãos abrangidos pelos orçamentos fiscal e da seguridade social. Não são despesas pessoais do governador, nem a soma dos gastos dos municípios e da União naquele território.</p>
      <p>Comparamos exercícios completos de {data.years.join(" e ")}, na mesma etapa: <strong className="font-medium text-zinc-200">despesa liquidada</strong>. Operações intraorçamentárias são excluídas. Restos a pagar de exercícios anteriores não são somados. A participação usa como denominador a despesa total liquidada, e não a receita ou um mínimo constitucional.</p>
      <p>Por habitante = despesa ÷ população estimada pelo IBGE para julho do mesmo ano. Comparações entre anos usam reais nominais e não descontam a inflação. Diferenças demográficas, competências, transferências e classificações contábeis também afetam os resultados. Mais gasto não significa automaticamente melhor serviço.</p>
      <p>Saúde, educação e segurança são funções da despesa (DCA, anexo I-E). Investimentos são uma categoria econômica (anexo I-D), descontadas as modalidades intraorçamentárias. Essas classificações se sobrepõem: investimentos não devem ser somados às funções.</p>
      <div className="grid gap-4 sm:grid-cols-2">{states.map((s,i)=><div key={`${s.uf}-${i}`} className="min-w-0 rounded-xl bg-white/[0.025] p-4"><h3 className="font-medium text-zinc-200">{s.name} · {selection.year}</h3><p className="mt-1 text-xs">Consulta: {records[i]?date(records[i]!.fetchedAt):"indisponível"}</p><div className="mt-3 flex flex-wrap gap-3 text-xs">{records[i]?.sourceUrls.map((url,j)=><a key={url} href={url} target="_blank" rel="noreferrer" className="text-emerald-300 underline">Siconfi · anexo I-{j===0?"E":"D"} ↗</a>)}</div>{governors.find(g=>g.uf===s.uf)&&<p className="mt-3 text-xs">Titular atual: <Link href={`/politico/${governors.find(g=>g.uf===s.uf)!.id}`} className="text-sky-200 underline">{governors.find(g=>g.uf===s.uf)!.name}</Link>. Cadastro verificado em {date(governors.find(g=>g.uf===s.uf)!.verifiedAt)}; não identifica quem governava durante todo o exercício comparado.</p>}</div>)}</div>
      <p className="text-xs"><a href={data.populationSource.url} target="_blank" rel="noreferrer" className="text-emerald-300 underline">IBGE · população usada nos cálculos ↗</a>{" · "}<a href="https://www.tesourotransparente.gov.br/ckan/dataset/api-dca-entes" target="_blank" rel="noreferrer" className="text-emerald-300 underline">Documentação das contas anuais ↗</a>{" · "}<a href="/data/_state-spending.json" download className="text-emerald-300 underline">Baixar dados da comparação</a></p>
      <p className="text-xs text-zinc-500">Dados autodeclarados pelos entes ao Siconfi e sujeitos a retificação. Consulta fiscal mais recente: {date(data.fetchedAt)}. População consultada em {date(data.populationSource.fetchedAt)}. A data de consulta não é a data de publicação original do relatório.</p>
    </section>
  </div>;
}
