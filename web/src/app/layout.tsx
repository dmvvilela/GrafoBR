import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import Providers from "@/components/Providers";
import { getMeta, getObras } from "@/lib/data";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://grafo-br.vercel.app"),
  title: "GrafoBR — conexões de dados públicos",
  description:
    "Grafo aberto das conexões de parlamentares federais a partir de dados públicos. Conexões não são acusações.",
};

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 7L17 5M6 7L11 18M17 5L11 18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity="0.55"
      />
      <circle cx="6" cy="7" r="2.6" fill="#34d399" />
      <circle cx="17" cy="5" r="2.2" fill="#818cf8" />
      <circle cx="11" cy="18" r="2.2" fill="#fbbf24" />
    </svg>
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enableAnalytics = process.env.NODE_ENV === "production";
  const [meta, obras] = await Promise.all([getMeta(), getObras()]);
  const snapshot = formatDate(meta?.generatedAt);
  const obrasSnapshot = formatDate(obras?.meta.generatedAt);
  return (
    <html lang="pt-BR">
      <body>
        {enableAnalytics && (
          <Script
            id="clarity"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","x7grwabn4k");`,
            }}
          />
        )}
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-white/5 bg-[#07070b]/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04] text-emerald-400 ring-1 ring-white/10">
                  <Logo />
                </span>
                <span className="text-[15px] font-semibold tracking-tight">
                  Grafo<span className="text-emerald-400">BR</span>
                </span>
              </Link>
              <nav className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 sm:text-sm">
                <Link href="/buscar" className="transition hover:text-zinc-100">
                  Buscar
                </Link>
                <Link
                  href="/rankings"
                  className="transition hover:text-zinc-100"
                >
                  Rankings
                </Link>
                <Link href="/obras" className="transition hover:text-zinc-100">
                  Obras
                </Link>
                <Link
                  href="/comparar"
                  className="transition hover:text-zinc-100"
                >
                  Comparar
                </Link>
                <Link href="/dados" className="transition hover:text-zinc-100">
                  Dados
                </Link>
                <Link href="/sobre" className="transition hover:text-zinc-100">
                  Sobre
                </Link>
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
            <Providers>{children}</Providers>
          </main>

          <footer className="border-t border-white/5 px-5 py-7 text-xs leading-relaxed text-zinc-500">
            <div className="mx-auto max-w-6xl space-y-1.5">
              <p>
                Dados públicos por lei, vindos das fontes exibidas em cada
                grafo. As conexões refletem registros públicos e{" "}
                <strong className="font-medium text-zinc-300">
                  não constituem acusação de irregularidade
                </strong>
                . Encontrou um erro? Os dados vêm direto das fontes oficiais.
              </p>
              <p className="text-zinc-600">
                Projeto aberto · v0 · dados estáticos pré-computados.
                {snapshot ? ` Snapshot principal: ${snapshot}.` : ""}
                {obrasSnapshot ? ` Obras: ${obrasSnapshot}.` : ""}
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
