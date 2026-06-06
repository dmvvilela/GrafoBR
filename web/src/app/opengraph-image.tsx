import { ImageResponse } from "next/og";
import { getIndex } from "@/lib/data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "GrafoBR — conexões de dados públicos";

export default async function Image() {
  const index = await getIndex();
  const dots = ["#818cf8", "#34d399", "#fbbf24", "#2dd4bf", "#c084fc"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#07070b",
          padding: "72px",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div style={{ width: 18, height: 18, borderRadius: 999, background: "#34d399", display: "flex" }} />
          <div style={{ fontSize: 32, fontWeight: 700 }}>GrafoBR</div>
        </div>

        <div style={{ display: "flex", fontSize: 78, fontWeight: 700, lineHeight: 1.05, maxWidth: 980 }}>
          Conexões de dados públicos dos parlamentares federais
        </div>

        <div style={{ display: "flex", fontSize: 34, color: "#a1a1aa", marginTop: 28, maxWidth: 900 }}>
          Doações, empresas, contratos, cota parlamentar e emendas — de dados públicos.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 44 }}>
          {dots.map((c, i) => (
            <div key={i} style={{ width: 22, height: 22, borderRadius: 999, background: c, display: "flex" }} />
          ))}
          <div style={{ display: "flex", fontSize: 28, color: "#71717a", marginLeft: 8 }}>
            {`${index.length} parlamentares · grafo-br.vercel.app`}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
