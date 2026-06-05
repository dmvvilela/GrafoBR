"use client";

import { useState } from "react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Official Câmara deputy portrait, resolved from the numeric id. Falls back to a
// gradient monogram if the photo 404s.
export default function Avatar({
  id,
  name,
  size = 44,
}: {
  id: number;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size };

  if (failed || !id) {
    return (
      <span
        style={dim}
        className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-400/20 to-emerald-400/20 text-sm font-semibold text-indigo-200 ring-1 ring-white/10"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`}
      alt={name}
      style={dim}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-xl object-cover object-top ring-1 ring-white/10"
    />
  );
}
