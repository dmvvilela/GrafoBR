import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrafoBR — conexões de dados públicos",
  description:
    "Grafo aberto de conexões de parlamentares federais a partir de dados públicos. Conexões não são acusações.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
      </body>
    </html>
  );
}
