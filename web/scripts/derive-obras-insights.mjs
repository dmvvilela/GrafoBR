// Per-politician Obrasgov context. This does not assert that a deputy caused or
// funded an obra; it surfaces state-level public works signals and weak thematic
// leads from the deputy's emenda areas for further investigation.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../public/data");

const MAX_STATE_PROJECTS = 5;
const MAX_THEME_MATCHES = 5;

const THEME_KEYWORDS = {
  Saúde: ["saude", "hospital", "ubs", "upa", "unidade basica"],
  Educação: [
    "educacao",
    "universidade",
    "escola",
    "instituto federal",
    "campus",
  ],
  Urbanismo: [
    "urbanismo",
    "cidades",
    "pavimentacao",
    "saneamento",
    "drenagem",
    "calcamento",
  ],
  "Segurança pública": ["seguranca publica", "delegacia", "policia"],
  "Desporto e lazer": ["desporto", "esporte", "quadra", "ginasio"],
  Cultura: ["cultura", "museu", "teatro", "patrimonio"],
  "Ciência e tecnologia": ["ciencia", "tecnologia", "laboratorio"],
  Transporte: ["transporte", "infraestrutura de transportes", "rodovia", "br-"],
};

function brlFromDescription(description, keyword) {
  const m =
    description &&
    description.match(new RegExp(`R\\$\\s*([\\d.]+,\\d{2})\\s*${keyword}`));
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : 0;
}

function norm(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, " ")
    .trim()
    .toLowerCase();
}

function projectText(project) {
  return norm(
    [
      project.nome,
      project.executor,
      project.repassador,
      project.situacao,
      project.especie,
      project.natureza,
    ].join(" "),
  );
}

function compactProject(project) {
  return {
    id: project.id,
    nome: project.nome,
    uf: project.uf ?? null,
    municipio: project.municipio ?? null,
    codigoMunicipio: project.codigoMunicipio ?? null,
    situacao: project.situacao ?? null,
    signals: project.signals ?? [],
    valorPrevisto: project.valorPrevisto ?? null,
    dataFinalPrevista: project.dataFinalPrevista ?? null,
    diasAtraso: project.diasAtraso ?? 0,
    percentualFisico: project.percentualFisico ?? null,
    executor: project.executor ?? null,
    repassador: project.repassador ?? null,
    orgao: project.orgao ?? null,
    sourceIds: project.sourceIds ?? null,
  };
}

function scoreProject(project) {
  const signals = new Set(project.signals ?? []);
  return (
    (signals.has("paralisada") ? 3_000_000_000 : 0) +
    (signals.has("atrasada") ? 2_000_000_000 : 0) +
    (signals.has("baixo_avanco") ? 1_000_000_000 : 0) +
    (project.valorPrevisto ?? 0) +
    (project.diasAtraso ?? 0) * 1000
  );
}

function stateSummary(projects) {
  return {
    total: projects.length,
    paralisadas: projects.filter((p) => p.signals?.includes("paralisada")).length,
    atrasadas: projects.filter((p) => p.signals?.includes("atrasada")).length,
    baixoAvanco: projects.filter((p) => p.signals?.includes("baixo_avanco")).length,
    valorPrevisto: Math.round(
      projects.reduce((sum, p) => sum + (p.valorPrevisto ?? 0), 0),
    ),
    top: projects
      .toSorted((a, b) => scoreProject(b) - scoreProject(a))
      .slice(0, MAX_STATE_PROJECTS)
      .map(compactProject),
  };
}

function emendaAreas(ego) {
  const byId = new Map(ego.nodes.map((n) => [n.id, n]));
  const areas = new Map();
  for (const link of ego.links) {
    if (link.connectionType !== "emenda") continue;
    const endpoints = [byId.get(link.source), byId.get(link.target)];
    const dest = endpoints.find((n) => n?.category === "destino");
    if (!dest) continue;
    const current = areas.get(dest.name) ?? { area: dest.name, empenhado: 0, pago: 0 };
    current.empenhado += brlFromDescription(link.description, "empenhado");
    current.pago += brlFromDescription(link.description, "pago");
    areas.set(dest.name, current);
  }
  return [...areas.values()]
    .map((area) => ({
      ...area,
      empenhado: Math.round(area.empenhado),
      pago: Math.round(area.pago),
    }))
    .sort((a, b) => b.empenhado - a.empenhado);
}

function themeMatches(areas, stateProjects) {
  const matches = [];
  const usedProjects = new Set();
  for (const area of areas) {
    const keywords = THEME_KEYWORDS[area.area];
    if (!keywords) continue;
    const candidates = stateProjects
      .map((project) => ({
        project,
        text: projectText(project),
      }))
      .filter(({ project, text }) => {
        if (usedProjects.has(project.id)) return false;
        return keywords.some((keyword) => text.includes(norm(keyword)));
      })
      .sort((a, b) => scoreProject(b.project) - scoreProject(a.project));

    for (const { project } of candidates.slice(0, 2)) {
      usedProjects.add(project.id);
      matches.push({
        kind: "same_uf_theme",
        confidence: "baixa",
        area: area.area,
        emendaEmpenhada: area.empenhado,
        evidence: [
          "mesma UF do parlamentar",
          `tema de emenda: ${area.area}`,
          "texto do projeto/orgao sugere tema parecido",
        ],
        project: compactProject(project),
      });
      if (matches.length >= MAX_THEME_MATCHES) return matches;
    }
  }
  return matches;
}

const index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
const obras = JSON.parse(await readFile(path.join(dir, "_obras.json"), "utf8"));
const projects = obras.all ?? [];
const projectsByUf = Map.groupBy(
  projects.filter((p) => p.uf),
  (p) => p.uf,
);

const out = {};
let withStateSignals = 0;
let withThemeMatches = 0;

for (const entry of index) {
  if (!entry.uf) continue;
  const file = path.join(dir, `${entry.id}.json`);
  let ego;
  try {
    ego = JSON.parse(await readFile(file, "utf8"));
  } catch {
    continue;
  }

  const stateProjects = projectsByUf.get(entry.uf) ?? [];
  if (stateProjects.length === 0) continue;

  const areas = emendaAreas(ego);
  const insight = {
    uf: entry.uf,
    state: stateSummary(stateProjects),
    emendaAreas: areas.slice(0, 6),
    possibleMatches: themeMatches(areas, stateProjects),
    note:
      "Contexto por UF e correspondencias tematicas fracas; nao atribui autoria, responsabilidade ou financiamento a parlamentar.",
  };

  if (insight.state.total > 0) withStateSignals += 1;
  if (insight.possibleMatches.length > 0) withThemeMatches += 1;
  out[String(entry.id)] = insight;
}

await writeFile(path.join(dir, "_obras-insights.json"), JSON.stringify(out), "utf8");

console.log(
  `[derive-obras-insights] ${withStateSignals} politicians with UF obras context; ${withThemeMatches} with thematic leads`,
);
