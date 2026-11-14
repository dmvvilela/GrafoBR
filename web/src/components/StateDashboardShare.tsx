"use client";
import { useState } from "react";
import { SITE_HOST } from "@/lib/site";

export default function StateDashboardShare({
  name,
  path,
  spending,
  contracts,
  sources,
  disabled,
}: {
  name: string;
  path: string;
  spending: string[];
  contracts: string[];
  sources: string[];
  disabled: boolean;
}) {
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");
  async function copy() {
    const link = new URL(path, location.origin).href;
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copiado.");
    } catch {
      setManual(link);
    }
  }
  function generate() {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error();
      const lines: { text: string; size: number; color: string; y: number }[] =
        [];
      let y = 70;
      function block(text: string, size: number, color = "#e4e4e7", gap = 18) {
        y += gap;
        ctx!.font = `${size}px Arial`;
        let line = "";
        // Character wrapping also handles long URLs without clipping.
        for (const word of text.split(/\s+/)) {
          if (line && ctx!.measureText(`${line} ${word}`).width > 1060) {
            lines.push({ text: line, size, color, y });
            y += size * 1.4;
            line = "";
          }
          for (const char of (line ? " " : "") + word) {
            if (ctx!.measureText(line + char).width > 1060) {
              lines.push({ text: line, size, color, y });
              y += size * 1.4;
              line = "";
            }
            line += char;
          }
        }
        lines.push({ text: line, size, color, y });
        y += size * 1.4;
      }
      block("GrafoBR / MEU ESTADO", 24, "#6ee7b7", 0);
      block(name, 52, "#ffffff", 24);
      block("CONTAS ANUAIS · SICONFI + IBGE", 22, "#a5b4fc", 28);
      spending.forEach((line, i) => block(line, i === 0 ? 30 : 27));
      block("CONTRATOS PUBLICADOS · PNCP", 22, "#6ee7b7", 32);
      contracts.forEach((line) => block(line, 27));
      block(
        "Contas anuais e valores contratuais têm períodos e conceitos diferentes. Não devem ser somados. Mais gasto não mede qualidade dos serviços.",
        23,
        "#a1a1aa",
        30,
      );
      sources.forEach((line) => block(line, 19, "#a1a1aa", 12));
      block(`${SITE_HOST}${path}`, 18, "#6ee7b7", 22);
      canvas.height = Math.ceil(y + 45);
      ctx.fillStyle = "#090d18";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const line of lines) {
        ctx.font = `${line.size}px Arial`;
        ctx.fillStyle = line.color;
        ctx.fillText(line.text, 64, line.y);
      }
      setPreview(canvas.toDataURL("image/png"));
      setMessage("");
    } catch {
      setMessage(
        "Não foi possível gerar o card. Você ainda pode copiar o link.",
      );
    }
  }
  return (
    <section
      id="compartilhar"
      className="scroll-mt-40 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.03] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Seu estado, em um card</h2>
          <p className="mt-2 text-sm text-zinc-400">
            As duas bases, seus períodos e fontes acompanham a imagem.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copy}
            className="rounded-xl border border-white/20 px-4 py-3 text-sm"
          >
            Copiar link
          </button>
          <button
            onClick={generate}
            disabled={disabled}
            className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40"
          >
            Criar card
          </button>
        </div>
      </div>
      {disabled && (
        <p className="mt-3 text-xs text-zinc-400">
          O card aguarda contas anuais disponíveis para o ano selecionado.
        </p>
      )}
      <p aria-live="polite" className="mt-3 text-sm text-emerald-200">
        {message}
      </p>
      {manual && (
        <input
          aria-label="Link do painel para copiar"
          readOnly
          value={manual}
          onFocus={(e) => e.target.select()}
          className="w-full rounded-lg bg-zinc-950 p-3 text-xs"
        />
      )}
      {preview && (
        <div className="mt-5 space-y-4">
          <img
            src={preview}
            alt={`Card Meu estado: ${name}`}
            className="mx-auto w-full max-w-xl rounded-xl"
          />
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={preview}
              download={`grafobr-meu-estado-${path.split("/")[2].split("?")[0]}.png`}
              className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950"
            >
              Baixar PNG
            </a>
            <button
              onClick={() => setPreview("")}
              className="px-4 py-3 text-sm"
            >
              Fechar prévia
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
