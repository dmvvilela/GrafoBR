import { ImageResponse } from "next/og";
import { getEgo, getEmendaRanking, getIndex } from "@/lib/data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "GrafoBR";

export async function generateStaticParams() {
  const index = await getIndex();
  return index.map((entry) => ({ id: String(entry.id) }));
}

function compactBRL(v: number): string {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1).replace(".", ",")} bi`;
  if (v >= 1e6) return `R$ ${Math.round(v / 1e6)} mi`;
  if (v >= 1e3) return `R$ ${Math.round(v / 1e3)} mil`;
  return `R$ ${Math.round(v)}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ego, index, ranking] = await Promise.all([
    getEgo(id),
    getIndex(),
    getEmendaRanking(),
  ]);
  const name = ego?.meta?.egoName ?? "Deputado federal";
  const entry = index.find((e) => String(e.id) === id);
  const em = ranking.find((r) => String(r.id) === id);
  const sub = [entry?.party, entry?.uf].filter(Boolean).join(" · ");
  const headline = em
    ? `${compactBRL(em.empenhado)} em emendas individuais`
    : "Conexões de dados públicos";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#07070b",
          padding: "64px",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#34d399",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 28, fontWeight: 700 }}>GrafoBR</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 999,
              background: "#1f2937",
              border: "4px solid #34d39955",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 72,
              fontWeight: 700,
              color: "#a7f3d0",
            }}
          >
            {initials(name)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.05 }}>{name}</div>
            {sub ? (
              <div style={{ fontSize: 30, color: "#a1a1aa", marginTop: 10 }}>{sub}</div>
            ) : null}
            <div
              style={{
                fontSize: 36,
                color: "#c084fc",
                marginTop: 22,
                fontWeight: 600,
              }}
            >
              {headline}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "#71717a" }}>
          grafo-br.vercel.app · conexões de dados públicos, não acusações
        </div>
      </div>
    ),
    { ...size },
  );
}
