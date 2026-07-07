"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10"
    >
      <Printer size={13} />
      Imprimir
    </button>
  );
}
