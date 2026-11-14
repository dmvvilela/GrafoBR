import type { MetadataRoute } from "next";
import { getIndex, getMeta, getObras, getStateSpending, getStateContracts } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

const STATIC_ROUTES = [
  "",
  "/buscar",
  "/rankings",
  "/obras",
  "/comparar",
  "/estados",
  "/meu-estado",
  "/meu-estado/sp",
  "/meu-estado/mg",
  "/contratos",
  "/dados",
  "/dados/qa",
  "/eleicoes",
  "/atualizacoes",
  "/sobre",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [index, meta, obras, spending, contracts] = await Promise.all([
    getIndex(),
    getMeta(),
    getObras(),
    getStateSpending(),
    getStateContracts(),
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
      lastModified: route.startsWith("/meu-estado") ? new Date(Math.max(...[spending?.fetchedAt, contracts?.fetchedAt].filter((v): v is string => !!v).map(v => new Date(v).getTime()), 0)) : route === "/contratos" && contracts ? new Date(contracts.fetchedAt) : route === "/estados" && spending ? new Date(spending.fetchedAt) : route.startsWith("/obras") ? obrasDate : snapshotDate,
    })),
    ...(contracts?.contracts ?? []).map(c => ({url:absoluteUrl(`/contratos/${c.id}`), lastModified:new Date(contracts!.fetchedAt)})),
    ...(contracts?.suppliers ?? []).map(s => ({url:absoluteUrl(`/fornecedores/${s.id}`), lastModified:new Date(contracts!.fetchedAt)})),
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
