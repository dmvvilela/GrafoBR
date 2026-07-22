import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../public/data");

function pct(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function validDate(value) {
  if (!value) return true;
  const year = Number(String(value).slice(0, 4));
  return Number.isFinite(year) && year >= 1990 && year <= 2100;
}

function reliableMoney(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 1;
}

function inc(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function topMap(map, limit = 12) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

const generatedAt = new Date().toISOString();
const index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
let obras = null;
try {
  obras = JSON.parse(await readFile(path.join(dir, "_obras.json"), "utf8"));
} catch {}

const sourceCounts = new Map();
const chamberCounts = new Map();
const nodeCategoryCounts = new Map();
const connectionCounts = new Map();
const missing = {
  profileName: 0,
  party: 0,
  uf: 0,
  sources: 0,
  metaEgoId: 0,
  linkDescription: 0,
  entityId: 0,
  sourceCoverage: 0,
};
const broken = {
  unreadableProfileFiles: 0,
  duplicateNodeIds: 0,
  duplicateLinkIds: 0,
  linksWithMissingEndpoint: 0,
  linksWithSelfLoop: 0,
};
const totals = {
  profiles: index.length,
  emptyGraphs: 0,
  nodes: 0,
  links: 0,
};
const samples = {
  emptyGraphs: [],
  missingUf: [],
  missingParty: [],
  brokenLinks: [],
};

for (const entry of index) {
  inc(chamberCounts, entry.chamber ?? "camara");
  if (!entry.name) missing.profileName += 1;
  if (!entry.party) {
    missing.party += 1;
    if (samples.missingParty.length < 12) samples.missingParty.push(entry.id);
  }
  if (!entry.uf) {
    missing.uf += 1;
    if (samples.missingUf.length < 12) samples.missingUf.push(entry.id);
  }
  if (!entry.sources?.length) missing.sources += 1;
  for (const source of entry.sources ?? []) inc(sourceCounts, source);

  let ego;
  try {
    ego = JSON.parse(await readFile(path.join(dir, `${entry.id}.json`), "utf8"));
  } catch {
    broken.unreadableProfileFiles += 1;
    continue;
  }

  if (!ego.meta?.egoId) missing.metaEgoId += 1;
  if (
    !ego.meta?.sourceCoverage ||
    Object.keys(ego.meta.sourceCoverage).length !== (ego.meta.sources?.length ?? 0)
  ) {
    missing.sourceCoverage += 1;
  }
  if (!ego.links?.length) {
    totals.emptyGraphs += 1;
    if (samples.emptyGraphs.length < 12) samples.emptyGraphs.push(entry.id);
  }

  totals.nodes += ego.nodes?.length ?? 0;
  totals.links += ego.links?.length ?? 0;

  const nodeIds = new Set();
  for (const node of ego.nodes ?? []) {
    inc(nodeCategoryCounts, node.category ?? "unknown");
    if (["donor", "supplier", "company"].includes(node.category) && !node.entityId) {
      missing.entityId += 1;
    }
    if (nodeIds.has(node.id)) broken.duplicateNodeIds += 1;
    nodeIds.add(node.id);
  }

  const linkIds = new Set();
  for (const link of ego.links ?? []) {
    inc(connectionCounts, link.connectionType ?? "unknown");
    if (!link.description) missing.linkDescription += 1;
    if (linkIds.has(link.id)) broken.duplicateLinkIds += 1;
    linkIds.add(link.id);
    if (!nodeIds.has(link.source) || !nodeIds.has(link.target)) {
      broken.linksWithMissingEndpoint += 1;
      if (samples.brokenLinks.length < 12) {
        samples.brokenLinks.push({ profile: entry.id, link: link.id });
      }
    }
    if (link.source === link.target) broken.linksWithSelfLoop += 1;
  }
}

const obrasQa = obras
  ? {
      total: obras.all?.length ?? 0,
      flagged: obras.meta?.counts?.flagged ?? 0,
      paralisada: obras.meta?.counts?.paralisada ?? 0,
      atrasada: obras.meta?.counts?.atrasada ?? 0,
      missingReliableValue: (obras.all ?? []).filter(
        (project) => !reliableMoney(project.valorPrevisto),
      ).length,
      invalidDates: (obras.all ?? []).filter(
        (project) => !validDate(project.dataFinalPrevista),
      ).length,
      missingUf: (obras.all ?? []).filter((project) => !project.uf).length,
      missingSignals: (obras.all ?? []).filter(
        (project) => !(project.signals ?? []).length,
      ).length,
    }
  : null;

const warningItems = [
  {
    id: "empty_graphs",
    severity: totals.emptyGraphs > totals.profiles * 0.1 ? "warn" : "info",
    label: "Perfis sem vínculos",
    count: totals.emptyGraphs,
    detail:
      "Ausência no recorte usado; não significa ausência de relações fora das fontes.",
  },
  {
    id: "missing_endpoint",
    severity: broken.linksWithMissingEndpoint > 0 ? "error" : "ok",
    label: "Links com ponta ausente",
    count: broken.linksWithMissingEndpoint,
    detail: "Cada link precisa apontar para dois nós existentes no mesmo ego-grafo.",
  },
  {
    id: "duplicate_ids",
    severity: broken.duplicateNodeIds + broken.duplicateLinkIds > 0 ? "error" : "ok",
    label: "IDs duplicados",
    count: broken.duplicateNodeIds + broken.duplicateLinkIds,
    detail: "IDs duplicados podem quebrar seleção, exportação e layout do grafo.",
  },
  {
    id: "obras_value",
    severity:
      obrasQa && obrasQa.total && pct(obrasQa.missingReliableValue, obrasQa.total) > 30
        ? "warn"
        : "info",
    label: "Obras sem valor confiável",
    count: obrasQa?.missingReliableValue ?? 0,
    detail: "Valores R$0/R$0,01 são tratados como sentinela ou ausentes.",
  },
];

const qa = {
  generatedAt,
  snapshotGeneratedAt: null,
  totals,
  coverage: {
    bySource: topMap(sourceCounts, 20),
    byChamber: topMap(chamberCounts, 10),
    byNodeCategory: topMap(nodeCategoryCounts, 20),
    byConnectionType: topMap(connectionCounts, 20),
  },
  missing,
  broken,
  obras: obrasQa,
  warnings: warningItems,
  samples,
  note:
    "QA build-time: aponta anomalias estruturais e lacunas de cobertura; não acusa irregularidade.",
};

try {
  const meta = JSON.parse(await readFile(path.join(dir, "_meta.json"), "utf8"));
  qa.snapshotGeneratedAt = meta.generatedAt ?? null;
} catch {}

await writeFile(path.join(dir, "_qa.json"), JSON.stringify(qa, null, 2), "utf8");
console.log(
  `[derive-qa] ${totals.profiles} profiles, ${totals.links} links, ${warningItems.filter((item) => item.severity !== "ok").length} warnings`,
);

const fatalCount =
  broken.unreadableProfileFiles +
  broken.duplicateNodeIds +
  broken.duplicateLinkIds +
  broken.linksWithMissingEndpoint +
  broken.linksWithSelfLoop +
  missing.metaEgoId +
  missing.linkDescription +
  missing.entityId +
  missing.sourceCoverage;
if (fatalCount > 0) {
  throw new Error(`[derive-qa] refusing to publish: ${fatalCount} structural error(s)`);
}
