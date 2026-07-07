"use client";

import { Download } from "lucide-react";

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

export default function ExportButton({
  filename,
  payload,
  rows,
  label = "Exportar",
}: {
  filename: string;
  payload?: unknown;
  rows?: Record<string, unknown>[];
  label?: string;
}) {
  const isCsv = filename.endsWith(".csv");
  return (
    <button
      type="button"
      onClick={() => {
        if (isCsv) {
          downloadText(filename, toCsv(rows ?? []), "text/csv;charset=utf-8");
        } else {
          downloadText(
            filename,
            JSON.stringify(payload ?? rows ?? {}, null, 2),
            "application/json;charset=utf-8",
          );
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10"
    >
      <Download size={13} />
      {label}
    </button>
  );
}
