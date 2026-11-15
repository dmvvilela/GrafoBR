export const dynamic = "force-static";
import { allKnownContracts, allKnownSuppliers } from "@/lib/contract-history";
import type { MetadataRoute } from "next";
import {
  getIndex,
  getMeta,
  getObras,
  getStateSpending,
  getStateContracts,
} from "@/lib/data";
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
  "/meu-estado/rj",
  "/meu-estado/df",
  "/contratos",
  "/contratos/historico",
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
      lastModified: route.startsWith("/meu-estado")
        ? new Date(
            Math.max(
              ...[spending?.fetchedAt, contracts?.fetchedAt]
                .filter((v): v is string => !!v)
                .map((v) => new Date(v).getTime()),
              0,
            ),
          )
        : route === "/contratos" && contracts
          ? new Date(contracts.fetchedAt)
          : route === "/estados" && spending
            ? new Date(spending.fetchedAt)
            : route.startsWith("/obras")
              ? obrasDate
              : snapshotDate,
    })),
    ...(contracts ? allKnownContracts(contracts) : []).map((c) => ({
      url: absoluteUrl(`/contratos/${c.id}`),
      lastModified: new Date(contracts!.fetchedAt),
    })),
    ...(contracts ? allKnownSuppliers(contracts) : []).map((s) => ({
      url: absoluteUrl(`/fornecedores/${s.id}`),
      lastModified: new Date(contracts!.fetchedAt),
    })),
    ...(contracts?.history?.events ?? []).map((e) => ({
      url: absoluteUrl(`/contratos/historico/${e.id}`),
      lastModified: new Date(e.observedAt),
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
