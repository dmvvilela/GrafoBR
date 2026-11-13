"use client";

import { useState } from "react";
import { SITE_HOST } from "@/lib/site";
import { formatSpending, METRICS, spendingAmount, spendingPath, spendingValue, UNITS, type SpendingSelection, type SpendingSnapshot } from "@/lib/state-spending";

export default function StateSpendingShare({ data, selection }: { data: SpendingSnapshot; selection: SpendingSelection }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");
  const path = spendingPath(selection, data.version);
  const states = [selection.a, selection.b].map(uf => data.states.find(s => s.uf === uf)!);
  const records = states.map(s => s.records.find(r => r.year === selection.year));
  const values = records.map(r => spendingValue(r, selection.metric, selection.unit));
  const unavailable = values.some(v => v == null) || selection.a === selection.b;
  async function copy() {
    const url = new URL(path, window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setMessage("Link copiado com estados, ano e medida selecionados."); }
    catch { setManual(url); setMessage("Copie o endereço abaixo."); }
  }
  function generate() {
    try {
      const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1280;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas unavailable");
      ctx.fillStyle = "#090d18"; ctx.fillRect(0,0,1200,1280);
      const gradient = ctx.createLinearGradient(0,0,1200,1280); gradient.addColorStop(0,"#818cf826"); gradient.addColorStop(1,"#2dd4bf0a"); ctx.fillStyle = gradient; ctx.fillRect(0,0,1200,1280);
      function text(t: string, x: number, y: number, size: number, color = "#e4e4e7", width = 1060) {
        ctx!.font = `${size}px Arial, sans-serif`; ctx!.fillStyle = color;
        let line = "";
        for (const word of t.split(/\s+/)) {
          if (line && ctx!.measureText(`${line} ${word}`).width > width) { ctx!.fillText(line,x,y); y += size*1.3; line=""; }
          line += `${line ? " " : ""}${word}`;
        }
        ctx!.fillText(line,x,y); return y+size*1.3;
      }
      text("GrafoBR  /  CONTAS DOS ESTADOS",64,65,23,"#6ee7b7");
      text(`${METRICS[selection.metric]} · ${selection.year}`,64,139,48,"#fafafa");
      text(UNITS[selection.unit],64,185,25,"#a1a1aa");
      const max = Math.max(...values.map(v=>v??0),1);
      states.forEach((state,i) => {
        const y = 260 + i*230; const color = i===0 ? "#a5b4fc" : "#5eead4";
        text(`${state.name} · ${state.uf}`,64,y,30,color,1050);
        text(formatSpending(values[i],selection.unit),64,y+60,44,"#fafafa");
        ctx!.fillStyle = "#ffffff0d"; ctx!.beginPath(); ctx!.roundRect(64,y+87,1072,20,10);ctx!.fill();
        ctx!.fillStyle = color; ctx!.beginPath();ctx!.roundRect(64,y+87,1072*(values[i]??0)/max,20,10);ctx!.fill();
        text(`Valor liquidado: ${formatSpending(spendingAmount(records[i],selection.metric),"total")} · ${records[i]!.population.toLocaleString("pt-BR")} habitantes`,64,y+145,22,"#a1a1aa");
      });
      let y = text("Despesa liquidada · valores nominais · sem operações intraorçamentárias",64,743,23,"#d4d4d8");
      if (selection.metric === "investment") y = text("Investimentos são uma categoria econômica e podem incluir saúde, educação e segurança.",64,y+10,22,"#d4d4d8");
      y = text("Contas consolidadas do estado/DF, incluindo seus poderes. O valor não mede qualidade do serviço nem gasto pessoal do governador.",64,y+16,23,"#d4d4d8");
      if (states.some(s=>s.uf==="DF")) y = text("DF acumula competências estaduais e municipais; transferências federais afetam a comparação.",64,y+10,21,"#d4d4d8");
      y = text(`Fontes: Tesouro/Siconfi DCA (I-E e I-D) e IBGE/SIDRA 6579, população de julho/${selection.year}.`,64,y+18,21,"#a1a1aa");
      y = text(`Dados consultados em ${new Date(data.fetchedAt).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})} · versão ${data.version}`,64,y+8,19,"#a1a1aa");
      const bottom = text(`${SITE_HOST}${path}`,64,y+10,18,"#6ee7b7");
      const output = document.createElement("canvas"); output.width = canvas.width; output.height = Math.ceil(bottom + 60);
      const out = output.getContext("2d"); if (!out) throw new Error("Canvas unavailable");
      out.drawImage(canvas,0,0);
      setPreview(output.toDataURL("image/png"));setMessage("");
    } catch { setMessage("Não foi possível gerar a imagem. Você ainda pode copiar o link."); }
  }
  return <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6" aria-label="Compartilhar comparação de estados">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="font-medium text-zinc-100">Leve a comparação com você</h2><p className="mt-1 text-sm text-zinc-400">O card inclui os valores, o período e as fontes.</p></div>
      <div className="flex flex-wrap gap-2">
        <button onClick={copy} className="rounded-xl border border-white/20 px-4 py-3 text-sm hover:bg-white/5">Copiar link</button>
        <button onClick={generate} disabled={unavailable} className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-200 disabled:opacity-40">Criar card</button>
      </div>
    </div>
    {unavailable && <p className="text-xs text-zinc-400">Selecione dois estados diferentes com dados disponíveis para gerar o card.</p>}
    <p aria-live="polite" className="text-sm text-emerald-200">{message}</p>
    {manual && <input aria-label="Link da comparação para copiar" readOnly value={manual} onFocus={e=>e.target.select()} className="w-full rounded-lg bg-zinc-950 p-3 text-xs"/>}
    {preview && <div className="space-y-4 border-t border-white/10 pt-4">
      {/* The preview and download use the same locally rendered PNG. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt={`Card de ${METRICS[selection.metric]} em ${selection.year}: ${states[0].name} e ${states[1].name}, ${UNITS[selection.unit]}`} className="mx-auto w-full max-w-xl rounded-xl" />
      <div className="flex flex-wrap justify-center gap-4"><a download={`grafobr-estados-${selection.a}-${selection.b}-${selection.year}.png`} href={preview} className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950">Baixar PNG</a><button onClick={()=>setPreview(null)} className="px-4 py-3 text-sm text-zinc-400">Fechar prévia</button></div>
    </div>}
  </section>;
}
