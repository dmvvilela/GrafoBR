// Per-politician Obrasgov context. This does not assert that a deputy caused or
// funded an obra; it surfaces state-level public works signals and weak thematic
// leads from the deputy's emenda areas for further investigation.
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "../public/data");
const rootDataDir = path.resolve(here, "../../data");

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

function sameMunicipality(project, destination) {
  const projectCode = String(project.codigoMunicipio ?? "").trim();
  const destCode = String(destination.codigoMunicipio ?? "").trim();
  if (projectCode && destCode && projectCode === destCode) return true;

  const municipality = norm(destination.municipio ?? destination.localidade);
  if (!municipality || municipality === "sem informacao" || municipality === "nacional") {
    return false;
  }
  if (norm(project.municipio) === municipality) return true;
  return projectText(project).includes(municipality);
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
    valorPrevisto: reliableValue(project.valorPrevisto),
    dataFinalPrevista: validDate(project.dataFinalPrevista)
      ? project.dataFinalPrevista
      : null,
    diasAtraso: validDate(project.dataFinalPrevista)
      ? (project.diasAtraso ?? 0)
      : 0,
    percentualFisico: project.percentualFisico ?? null,
    executor: project.executor ?? null,
    repassador: project.repassador ?? null,
    orgao: project.orgao ?? null,
    sourceIds: project.sourceIds ?? null,
  };
}

function reliableValue(value) {
  return typeof value === "number" && value > 1 ? value : null;
}

function validDate(value) {
  if (!value) return false;
  const year = Number(String(value).slice(0, 4));
  return Number.isFinite(year) && year >= 1990;
}

function scoreProject(project) {
  const signals = new Set(project.signals ?? []);
  const delayScore = validDate(project.dataFinalPrevista)
    ? (project.diasAtraso ?? 0) * 1000
    : 0;
  return (
    (signals.has("paralisada") ? 3_000_000_000 : 0) +
    (signals.has("atrasada") ? 2_000_000_000 : 0) +
    (signals.has("baixo_avanco") ? 1_000_000_000 : 0) +
    (reliableValue(project.valorPrevisto) ?? 0) +
    delayScore
  );
}

function stateSummary(projects) {
  return {
    total: projects.length,
    paralisadas: projects.filter((p) => p.signals?.includes("paralisada")).length,
    atrasadas: projects.filter((p) => p.signals?.includes("atrasada")).length,
    baixoAvanco: projects.filter((p) => p.signals?.includes("baixo_avanco")).length,
    valorPrevisto: Math.round(
      projects.reduce((sum, p) => sum + (reliableValue(p.valorPrevisto) ?? 0), 0),
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

function keywordsForArea(area) {
  return THEME_KEYWORDS[area] ?? [];
}

function projectMatchesArea(project, area) {
  const keywords = keywordsForArea(area);
  if (!keywords.length) return false;
  const text = projectText(project);
  return keywords.some((keyword) => text.includes(norm(keyword)));
}

function matchStrength(project, area, baseReasons) {
  const signals = new Set(project.signals ?? []);
  const scoreReasons = [...baseReasons];
  let score = 0;
  if (signals.has("paralisada")) {
    score += 35;
    scoreReasons.push("obra paralisada");
  }
  if (signals.has("atrasada") && validDate(project.dataFinalPrevista)) {
    score += 25;
    scoreReasons.push("prazo vencido com data confiavel");
  }
  if (signals.has("baixo_avanco")) {
    score += 15;
    scoreReasons.push("baixo avanco fisico");
  }
  const keywords = keywordsForArea(area);
  const text = projectText(project);
  const matchedKeywords = keywords.filter((keyword) => text.includes(norm(keyword)));
  if (matchedKeywords.length > 0) {
    score += Math.min(20, matchedKeywords.length * 8);
    scoreReasons.push(`palavras-chave: ${matchedKeywords.slice(0, 3).join(", ")}`);
  }
  const value = reliableValue(project.valorPrevisto);
  if (value && value >= 1_000_000) {
    score += 5;
    scoreReasons.push("valor previsto relevante");
  }
  return { score, scoreReasons };
}

function themeMatches(areas, stateProjects, destinationRows) {
  const matches = [];
  const usedProjects = new Set();

  for (const destination of destinationRows) {
    if (!destination.municipio && !destination.localidade) continue;
    const candidates = stateProjects
      .filter((project) => {
        if (usedProjects.has(project.id)) return false;
        if (!sameMunicipality(project, destination)) return false;
        return projectMatchesArea(project, destination.funcao);
      })
      .sort((a, b) => scoreProject(b) - scoreProject(a));

    for (const project of candidates.slice(0, 1)) {
      const strength = matchStrength(project, destination.funcao, [
        "mesma UF do parlamentar",
        `municipio da emenda: ${destination.municipio ?? destination.localidade}`,
        `tema de emenda: ${destination.funcao}`,
      ]);
      usedProjects.add(project.id);
      matches.push({
        kind: "same_uf_municipio_theme",
        confidence: "media",
        score: 60 + strength.score,
        area: destination.funcao,
        subfuncao: destination.subfuncao ?? null,
        acao: destination.acao ?? null,
        municipio: destination.municipio ?? destination.localidade ?? null,
        codigoMunicipio: destination.codigoMunicipio ?? null,
        emendaEmpenhada: destination.empenhado ?? 0,
        emendaPaga: destination.pago ?? 0,
        emendas: destination.emendas ?? 0,
        sampleIds: destination.sampleIds ?? [],
        evidence: [
          "mesma UF do parlamentar",
          `municipio da emenda: ${destination.municipio ?? destination.localidade}`,
          `tema de emenda: ${destination.funcao}`,
          "texto/cadastro da obra sugere o mesmo municipio e tema",
        ],
        scoreReasons: strength.scoreReasons,
        project: compactProject(project),
      });
      if (matches.length >= MAX_THEME_MATCHES) return matches;
    }
  }

  for (const area of areas) {
    const keywords = keywordsForArea(area.area);
    if (!keywords.length) continue;
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
      const strength = matchStrength(project, area.area, [
        "mesma UF do parlamentar",
        `tema de emenda: ${area.area}`,
      ]);
      usedProjects.add(project.id);
      matches.push({
        kind: "same_uf_theme",
        confidence: "baixa",
        score: 30 + strength.score,
        area: area.area,
        emendaEmpenhada: area.empenhado,
        evidence: [
          "mesma UF do parlamentar",
          `tema de emenda: ${area.area}`,
          "texto do projeto/orgao sugere tema parecido",
        ],
        scoreReasons: strength.scoreReasons,
        project: compactProject(project),
      });
      if (matches.length >= MAX_THEME_MATCHES) return matches;
    }
  }
  return matches;
}

function authorKeys(entry, ego) {
  return new Set(
    [
      entry.name,
      ego.meta?.egoName,
      ego.meta?.civilName,
      ego.meta?.ballotName,
      ego.meta?.fullName,
    ]
      .map(norm)
      .filter(Boolean),
  );
}

const index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
const obras = JSON.parse(await readFile(path.join(dir, "_obras.json"), "utf8"));
const projects = obras.all ?? [];
const projectsByUf = Map.groupBy(
  projects.filter((p) => p.uf),
  (p) => p.uf,
);
let emendaDestinationRows = [];
for (const candidate of [
  path.join(rootDataDir, "_emenda-destinations.json"),
  path.join(dir, "_emenda-destinations.json"),
]) {
  try {
    const payload = JSON.parse(await readFile(candidate, "utf8"));
    emendaDestinationRows = payload.rows ?? [];
    break;
  } catch {}
}
const destinationsByAuthor = Map.groupBy(emendaDestinationRows, (row) =>
  norm(row.autor),
);
const outDir = path.join(dir, "obras-insights");
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

let withStateSignals = 0;
let withThemeMatches = 0;
let mediumMatches = 0;

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
  const names = authorKeys(entry, ego);
  const destinationRows = [...names]
    .flatMap((name) => destinationsByAuthor.get(name) ?? [])
    .filter(
      (row) =>
        row.uf === entry.uf ||
        row.uf == null ||
        row.uf === "" ||
        String(row.uf).length !== 2,
    )
    .sort((a, b) => (b.empenhado ?? 0) - (a.empenhado ?? 0));
  const insight = {
    uf: entry.uf,
    state: stateSummary(stateProjects),
    emendaAreas: areas.slice(0, 6),
    possibleMatches: themeMatches(areas, stateProjects, destinationRows),
    note:
      "Contexto por UF e correspondencias tematicas fracas; nao atribui autoria, responsabilidade ou financiamento a parlamentar.",
  };

  if (insight.state.total > 0) withStateSignals += 1;
  if (insight.possibleMatches.length > 0) withThemeMatches += 1;
  mediumMatches += insight.possibleMatches.filter(
    (match) => match.confidence === "media",
  ).length;
  await writeFile(
    path.join(outDir, `${entry.id}.json`),
    JSON.stringify(insight),
    "utf8",
  );
}

console.log(
  `[derive-obras-insights] ${withStateSignals} politicians with UF obras context; ${withThemeMatches} with thematic leads (${mediumMatches} municipality+theme)`,
);
