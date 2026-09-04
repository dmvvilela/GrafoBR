import type { MetadataRoute } from "next";
import { getIndex, getMeta, getObras } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

const STATIC_ROUTES = [
  "",
  "/buscar",
  "/rankings",
  "/obras",
  "/comparar",
  "/dados",
  "/dados/qa",
  "/eleicoes",
  "/atualizacoes",
  "/sobre",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [index, meta, obras] = await Promise.all([
    getIndex(),
    getMeta(),
    getObras(),
  ]);
  const snapshotDate = meta?.generatedAt
    ? new Date(meta.generatedAt)
    : undefined;
  const obrasDate = obras?.meta.generatedAt
    ? new Date(obras.meta.generatedAt)
    : snapshotDate;

  return [
    ...STATIC_ROUTES.map((route) => ({
      url: absoluteUrl(route || "/"),
      lastModified: route.startsWith("/obras") ? obrasDate : snapshotDate,
    })),
    ...index.map((politician) => ({
      url: absoluteUrl(`/politico/${politician.id}`),
      lastModified: snapshotDate,
    })),
    ...(obras?.all ?? []).map((obra) => ({
      url: absoluteUrl(`/obras/${encodeURIComponent(obra.id)}`),
      lastModified: obrasDate,
    })),
  ];
}
