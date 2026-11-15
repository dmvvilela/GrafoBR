const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const SITE_URL = (
  configuredOrigin || "https://grafo-br.dmvvilela.workers.dev"
).replace(/\/$/, "");

export const SITE_HOST = new URL(SITE_URL).host;

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, `${SITE_URL}/`).toString();
}
