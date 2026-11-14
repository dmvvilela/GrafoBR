"use client";
import { useState } from "react";
import { SITE_HOST } from "@/lib/site";
export default function ChangeShare({
  title,
  lines,
  path,
  summary = false,
}: {
  title: string;
  lines: string[];
  path: string;
  summary?: boolean;
}) {
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");
  async function copy() {
    const url = new URL(path, location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copiado.");
    } catch {
      setManual(url);
    }
  }
  function generate() {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error();
      let y = 74;
      const rows: { text: string; size: number; color: string; y: number }[] =
        [];
      function block(text: string, size: number, color: string) {
        ctx!.font = `${size}px Arial`;
        let line = "";
        for (const word of text.split(/\s+/)) {
          if (line && ctx!.measureText(line + " " + word).width > 1060) {
            rows.push({ text: line, size, color, y });
            y += size * 1.4;
            line = "";
          }
          for (const char of (line ? " " : "") + word) {
            if (ctx!.measureText(line + char).width > 1060) {
              rows.push({ text: line, size, color, y });
              y += size * 1.4;
              line = "";
            }
            line += char;
          }
        }
        rows.push({ text: line, size, color, y });
        y += size * 1.4 + 22;
      }
      block("GrafoBR / O QUE MUDOU · PNCP", 24, "#6ee7b7");
      block(title, 42, "#ffffff");
      lines.forEach((line) => block(line, 26, "#e4e4e7"));
      block(
        "Mudanças observadas no recorte SP/MG. Não são prova de aditivo, pagamento, cancelamento ou irregularidade.",
        22,
        "#a1a1aa",
      );
      block(`${SITE_HOST}${path}`, 20, "#6ee7b7");
      canvas.height = Math.ceil(y + 35);
      ctx.fillStyle = "#090d18";
      ctx.fillRect(0, 0, 1200, canvas.height);
      for (const row of rows) {
        ctx.font = `${row.size}px Arial`;
        ctx.fillStyle = row.color;
        ctx.fillText(row.text, 64, row.y);
      }
      setPreview(canvas.toDataURL("image/png"));
      setMessage("");
    } catch {
      setMessage(
        "Não foi possível gerar o card. Use o link para compartilhar.",
      );
    }
  }
  return (
    <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-5 sm:p-7">
      <h2 className="text-xl font-semibold">
        {summary
          ? "Compartilhar o resumo do histórico"
          : "Compartilhar o que mudou"}
      </h2>
      <p className="mt-2 text-sm text-zinc-400">
        O card inclui as datas de observação e os limites da comparação.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={copy}
          className="rounded-xl border border-white/20 px-4 py-3 text-sm"
        >
          Copiar link
        </button>
        <button
          onClick={generate}
          className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950"
        >
          {summary ? "Criar card do histórico" : "Criar card da mudança"}
        </button>
      </div>
      <p role="status" className="mt-3 text-sm text-emerald-200">
        {message}
      </p>
      {manual && (
        <input
          aria-label="Link para copiar"
          className="w-full rounded-lg bg-zinc-950 p-3 text-xs"
          readOnly
          value={manual}
          onFocus={(e) => e.target.select()}
        />
      )}
      {preview && (
        <div className="mt-4 space-y-4">
          <img
            src={preview}
            alt={`${summary ? "Card do histórico" : "Card da mudança"}: ${title}`}
            className="mx-auto w-full max-w-xl rounded-xl"
          />
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={preview}
              download="grafobr-mudanca-pncp.png"
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
