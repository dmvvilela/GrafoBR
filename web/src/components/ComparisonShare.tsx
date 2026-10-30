"use client";

import { useEffect, useState } from "react";
import type { EgoNetwork, GraphLink } from "@/lib/contract";
import type { SharedConnection } from "@/lib/comparison";
import { CONNECTION_LABELS } from "@/lib/graph-colors";
import { sourceForConnection } from "@/lib/evidence";
import { SITE_HOST } from "@/lib/site";

const SOURCE_KEYS: Record<string, string> = {
  doacao: "tse", despesa: "camara_ceap", socio: "receita", contrato: "transparencia", emenda: "cgu_emendas",
};
export function connectionPeriod(ego: EgoNetwork, link: GraphLink): string {
  return ego.meta.sourceCoverage[SOURCE_KEYS[link.connectionType]] ?? "Período não informado";
}

function makeCard(a: EgoNetwork, b: EgoNetwork, connection: SharedConnection): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  // Measure first, then draw: long names and coverage labels must never be cut.
  const rows: { text: string; x: number; y: number; size: number; color: string }[] = [];
  function block(text: string, x: number, y: number, width: number, size: number, color: string) {
    ctx!.font = `${size}px Arial, sans-serif`;
    let line = "";
    for (const word of text.split(/\s+/)) {
      if (line && ctx!.measureText(`${line} ${word}`).width > width) {
        rows.push({ text: line, x, y, size, color }); y += size * 1.4; line = "";
      }
      line += `${line ? " " : ""}${word}`;
    }
    if (line) rows.push({ text: line, x, y, size, color });
    return y + size * 1.4;
  }
  block("GrafoBR  /  CONEXÕES EM COMUM", 64, 70, 1072, 24, "#6ee7b7");
  let y = block("O que conecta estes dois?", 64, 142, 1072, 48, "#fafafa");
  y += 35;
  const leftEnd = block(a.meta.egoName, 64, y, 490, 36, "#a5b4fc");
  const rightEnd = block(b.meta.egoName, 646, y, 490, 36, "#5eead4");
  y = Math.max(leftEnd, rightEnd) + 60;
  const entityY = y;
  y = block(connection.left.name, 90, y + 44, 1020, 34, "#fafafa");
  if (connection.left.name !== connection.right.name) {
    y = block(`No outro perfil: ${connection.right.name}`, 90, y + 12, 1020, 24, "#a1a1aa");
  }
  y += 35;
  const entityBottom = y;
  y += 65;
  let evidenceBottom = y;
  for (const [ego, links, x] of [[a, connection.leftLinks, 64], [b, connection.rightLinks, 646]] as const) {
    let sideY = y;
    for (const link of links) {
      sideY = block(CONNECTION_LABELS[link.connectionType], x, sideY, 490, 26, "#f4f4f5") + 8;
      sideY = block(sourceForConnection(link.connectionType), x, sideY, 490, 22, "#a1a1aa") + 8;
      sideY = block(connectionPeriod(ego, link), x, sideY, 490, 22, "#a1a1aa") + 24;
    }
    evidenceBottom = Math.max(evidenceBottom, sideY);
  }
  y = evidenceBottom;
  y += 36;
  y = block("Uma entidade aparece nos dois perfis. Isso não demonstra relação direta entre os parlamentares nem irregularidade.", 64, y, 1072, 25, "#d4d4d8") + 25;
  const date = (ego: EgoNetwork) => new Date(ego.meta.generatedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  y = block(`Versões dos perfis: ${date(a)} e ${date(b)}. Recorte limitado de registros públicos.`, 64, y, 1072, 21, "#a1a1aa") + 12;
  y = block(`${SITE_HOST}/comparar?a=${a.meta.egoId}&b=${b.meta.egoId}`, 64, y, 1072, 23, "#6ee7b7");
  canvas.height = Math.ceil(y + 48);
  ctx.fillStyle = "#090d18"; ctx.fillRect(0, 0, 1200, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, 1200, canvas.height);
  gradient.addColorStop(0, "#818cf81a"); gradient.addColorStop(1, "#2dd4bf0d");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, canvas.height);
  ctx.strokeStyle = "#6366f1"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(300, entityY - 36); ctx.lineTo(600, entityY + 5); ctx.lineTo(900, entityY - 36); ctx.stroke();
  ctx.fillStyle = "#182333"; ctx.beginPath(); ctx.roundRect(64, entityY, 1072, entityBottom - entityY, 24); ctx.fill();
  for (const row of rows) {
    if (!row.text) continue;
    ctx.fillStyle = row.color; ctx.font = `${row.size}px Arial, sans-serif`; ctx.fillText(row.text, row.x, row.y);
  }
  return canvas.toDataURL("image/png");
}

export default function ComparisonShare({ a, b, connection, path }: {
  a: EgoNetwork; b: EgoNetwork; connection: SharedConnection; path: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  useEffect(() => { setPreview(null); setMessage(""); setManualUrl(""); }, [a, b, connection.entityId]);
  async function copy() {
    const url = new URL(path, window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setMessage("Link copiado com a conexão selecionada."); }
    catch { setManualUrl(url); setMessage("Copie o endereço abaixo."); }
  }
  function generate() {
    try { setPreview(makeCard(a, b, connection)); setMessage(""); }
    catch { setMessage("Não foi possível gerar a imagem neste navegador. Você pode copiar o link."); }
  }
  return <div className="space-y-3 border-t border-white/10 pt-5">
    <div className="flex flex-wrap gap-2">
      <button onClick={copy} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-zinc-100 hover:bg-white/5">Copiar link desta conexão</button>
      <button onClick={generate} className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-200">Criar card para compartilhar</button>
    </div>
    <p aria-live="polite" className="text-sm text-emerald-200">{message}</p>
    {manualUrl && <input aria-label="Link para copiar" readOnly value={manualUrl} onFocus={(event) => event.target.select()} className="w-full rounded-lg bg-zinc-950 p-3 text-xs" />}
    {preview && <div className="space-y-3 rounded-xl bg-black/20 p-4">
      {/* The preview is the exact PNG downloaded, with no remote image dependency. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt={`Card: ${a.meta.egoName} e ${b.meta.egoName} compartilham ${connection.left.name}`} className="mx-auto w-full max-w-lg rounded-xl" />
      <div className="flex justify-center gap-4 text-sm">
        <a href={preview} download={`grafobr-${a.meta.egoId}-${b.meta.egoId}.png`} className="font-medium text-emerald-300 underline">Baixar PNG</a>
        <button onClick={() => setPreview(null)} className="text-zinc-400">Fechar prévia</button>
      </div>
      <p className="text-center text-xs text-zinc-500">A imagem inclui fontes, períodos e contexto. Compartilhe também o link para consultar os registros.</p>
    </div>}
  </div>;
}
