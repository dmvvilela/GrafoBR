"use client";
import { useState } from "react";
import { SITE_HOST } from "@/lib/site";
export default function ContractShare({
  title,
  amount,
  facts,
  path,
  version,
}: {
  title: string;
  amount: string;
  facts: string[];
  path: string;
  version: string;
}) {
  const [preview, setPreview] = useState(""),
    [message, setMessage] = useState(""),
    [manual, setManual] = useState("");
  const href = `${path}?v=${version}`;
  async function copy() {
    const url = new URL(href, location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copiado.");
    } catch {
      setManual(url);
    }
  }
  function generate() {
    try {
      const c = document.createElement("canvas");
      c.width = 1200;
      c.height = 2200;
      const ctx = c.getContext("2d");
      if (!ctx) throw Error();
      ctx.fillStyle = "#090d18";
      ctx.fillRect(0, 0, c.width, c.height);
      function text(t: string, y: number, size: number, color = "#e4e4e7") {
        ctx!.font = `${size}px Arial`;
        ctx!.fillStyle = color;
        let line = "";
        for (const word of t.split(/\s+/)) {
          if (line && ctx!.measureText(`${line} ${word}`).width > 1060) {
            ctx!.fillText(line, 64, y);
            y += size * 1.35;
            line = "";
          }
          line += (line ? " " : "") + word;
        }
        ctx!.fillText(line, 64, y);
        return y + size * 1.35;
      }
      let y = text("GrafoBR / CONTRATOS ESTADUAIS · PNCP", 70, 24, "#6ee7b7");
      y = text(title, y + 44, 42);
      y = text(amount, y + 42, 52, "#a5b4fc");
      y = text(
        "Valor inicial nominal · não representa pagamentos",
        y + 10,
        25,
        "#a1a1aa",
      );
      for (const fact of facts) y = text(fact, y + 24, 27);
      y = text(
        "Conexões documentais não são acusações. O registro não atribui a contratação pessoalmente ao governador.",
        y + 35,
        24,
        "#a1a1aa",
      );
      y = text(`Fonte: PNCP · versão ${version}`, y + 20, 22, "#a1a1aa");
      y = text(`${SITE_HOST}${href}`, y + 20, 20, "#6ee7b7");
      const out = document.createElement("canvas");
      out.width = 1200;
      out.height = Math.ceil(y + 48);
      const o = out.getContext("2d");
      if (!o) throw Error();
      o.drawImage(c, 0, 0);
      setPreview(out.toDataURL("image/png"));
      setMessage("");
    } catch {
      setMessage("Não foi possível criar o card. Você pode copiar o link.");
    }
  }
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-medium">Compartilhe com contexto</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Valores, período e fonte acompanham a imagem.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl border border-white/20 px-4 py-3 text-sm"
            onClick={copy}
          >
            Copiar link
          </button>
          <button
            className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950"
            onClick={generate}
          >
            Criar card
          </button>
        </div>
      </div>
      <p aria-live="polite" className="mt-2 text-sm text-emerald-200">
        {message}
      </p>
      {manual && (
        <input
          readOnly
          value={manual}
          aria-label="Link para copiar"
          onFocus={(e) => e.target.select()}
          className="mt-3 w-full rounded bg-zinc-950 p-3 text-xs"
        />
      )}
      {preview && (
        <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
          <img
            src={preview}
            alt={`Card: ${title}, ${amount}`}
            className="mx-auto w-full max-w-xl rounded-xl"
          />
          <div className="flex justify-center gap-4">
            <a
              className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950"
              href={preview}
              download={`grafobr-${path.split("/").pop()}.png`}
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
