# GrafoBR — Build Plan

> Detailed, phase-by-phase plan for implementation. Written for the next model/dev.
> Pair this with `DECISIONS.md` (the *why*) and `DATA-CONTRACT.md` (the *seam*).

## 1. What we're building & why

A free, public, navigable graph of **Brazilian federal politicians** (513 deputados +
81 senadores ≈ 594) and their connections drawn from **already-public** government data:
campaign donations, company ownership (sócios), public contracts, and declared assets.

The motivating context: a viral Brazilian project (`br-acc` / "Cérebro Digital") proved
the *idea* but shipped as heavy infra (Neo4j, terabyte in-memory, gated person data) with
a demo-seeded public repo. Separately, the Epstein-files projects proved the *UX* for
dense relational data (D3 connection graphs, "make it feel like software people know").
GrafoBR = **br-acc's data approach + the Epstein graph UX + a leaner, free, static architecture.**

We are **not** rebuilding br-acc and **not** fusing the two projects' backends. We take
br-acc's *data-source knowledge* (which portals, which base URLs, how to normalize) and an
*independent* graph frontend, joined by a JSON contract.

## 2. Scope (v1)

**In scope:**
- The ~594 sitting federal deputies and senators as graph "seeds."
- For each: a bounded **ego-network** — entities within ~1–2 hops (their companies,
  campaign donors, contracts/companies that won them, close family where derivable).
- One static `{nodes,links}` JSON per politician.
- A frontend: search → politician page → interactive D3 graph + a plain-language summary.

**Explicitly out of scope for v1** (see `LEGAL.md` for why):
- Arbitrary "type any CPF" live lookup (heavy + legally risky).
- "Risk scores" / "corruption" labels. We surface connections, full stop.
- Live, user-driven AI chat (deferred; build-time AI only).
- Municipal/state officials (federal first; expand later if it works).

## 3. Architecture

```
SOURCES            Câmara, Senado, TSE (donations/candidates), Receita (CNPJ/QSA),
(public APIs/      Portal da Transparência (contracts), ... (registry in pipeline/)
 bulk files)
   │  download (cached)
   ▼
PIPELINE           Python orchestration + DuckDB for the joins.
(build time,       - normalize CPF/CNPJ (strip formatting, handle masking)
 GitHub Actions)   - seed = federal politicians; expand bounded ego-network per seed
   │               - assign integer node ids (CPF/CNPJ never leave the build)
   │               - compute connectionCount (degree); label edge types
   ▼
CONTRACT           one file per politician: { nodes, links }  (validated vs JSON Schema)
   │
   ▼
WEB                Next.js. Static per-politician pages (SSG) + D3 force graph (client).
(Vercel, free)     Search via Fuse.js over a small index. No backend.
```

Three layers, one optional. **No runtime database. No server in v1.** The pipeline's
output is just files; the frontend just reads them.

## 4. Tech stack (locked — see DECISIONS.md)

| Layer | Choice | Notes |
|---|---|---|
| Build/ETL | **Python + DuckDB** | DuckDB does the heavy joins for free, in-process. No Neo4j. |
| Orchestration | **GitHub Actions** cron | Weekly refresh; free CI. |
| Serve | **Static JSON** on CDN | Cloudflare R2 / Pages or committed to repo. No DB. |
| Frontend | **Next.js (App Router)** | SSG pages for SEO; API routes available later if needed. |
| Graph | **D3 / d3-force** | Reuse the (MIT) Epstein File Explorer component's approach. |
| Styling | **Tailwind** | v4 (CSS-first config). |
| Search | **Fuse.js** | Client-side over ~600 entries. |
| Pkg mgr | **pnpm** | Single JS app; **no workspace/monorepo** in v1 (see DECISIONS). |
| AI (later) | **Gemma 4 12B local** (Ollama) | Build-time enrichment only; output baked into JSON. |
| Vector (later) | **Neon Postgres + pgvector** | Only if/when a live AI feature is added. |

## 5. The data contract (the seam)

Defined in `contract/ego-network.schema.json`, documented in `DATA-CONTRACT.md`,
mirrored in TS at `web/src/lib/contract.ts`. Shape:

```jsonc
{
  "meta": { "egoId": 1, "egoName": "...", "generatedAt": "...", "disclaimer": "..." },
  "nodes": [ { "id": 1, "name": "...", "category": "politician", "connectionCount": 3 } ],
  "links": [ { "id": 1, "source": 1, "target": 2,
               "connectionType": "socio", "description": "...", "strength": 1 } ]
}
```

- `id` is an **integer**, never a CPF/CNPJ (privacy + legal — see LEGAL.md).
- `category` ∈ {`politician`,`company`,`donor`,`supplier`,`relative`,`other`} → drives node color.
- `connectionType` ∈ {`socio`,`doacao`,`despesa`,`contrato`,`parente`,`other`} → drives edge color.
- `connectionCount` = node degree → drives node size (scaled 5–24px).
- `strength` exists but is currently unused in rendering — don't over-invest.

**Both halves must agree on this and nothing else.** The pipeline validates its output
against the schema; the web imports the TS types.

## 6. Phases

### Phase 0 — Scaffold ✅ (done)
Repo structure, contract + synthetic sample, planning docs, web/pipeline stubs.

### Phase 1 — Prove the seam (frontend, zero data work)
**Goal:** `pnpm dev` renders the synthetic `contract/sample-ego-network.json` as a real
force graph.
- Implement `web/src/components/NetworkGraph.tsx` with d3-force:
  forceManyBody + forceLink + forceCenter + forceCollide; SVG nodes/edges; drag; zoom/pan.
  Node radius = `scaleLinear([0, maxConnectionCount], [5, 24])`. Node fill = category color
  (`web/src/lib/graph-colors.ts`). Edge stroke = connectionType color. Labels on nodes.
- Wire `web/src/app/page.tsx` to fetch `/data/sample-ego-network.json` and render it.
- **Done when:** you see Dep. Joana Exemplo connected to companies/donor/relative, draggable,
  zoomable. This validates the entire looks-half + the contract with no pipeline.

### Phase 2 — Pipeline v0 (one real source, a few politicians)
**Goal:** produce a *real* ego-network JSON for ~5 politicians from **one** source.
> **Read `docs/DATA-FEASIBILITY.md` first.** The 5 core extractors are verified *real*
> (not stubs); it lists exactly which logic to reuse vs what's genuinely new work, and why
> `parente` edges + amendment-steering are deferred past v1.
- Clone br-acc into `reference/` (see `reference/README.md`); read its source registry to
  confirm base URLs + field meanings. **Reimplement clean — don't copy AGPL code.**
- Start with **Câmara dados abertos** (deputies + their declared info) and **TSE
  donations** (donor → politician edges). Both are clean, keyed, no CPF-masking drama.
- DuckDB: load CSV/JSON → normalize → build nodes+links for the seed set → `emit.py`
  writes files validated against the contract schema.
- **Done when:** `data/<id>.json` for a few real deputies validates and renders in the
  Phase-1 frontend.

### Phase 3 — Full pipeline (scoped sources, all ~594, automated)
- Add sources incrementally: Receita **QSA** (politician/relative ↔ company "socio"),
  Portal da Transparência **contratos** (company ↔ gov, linked to politician via amendments
  where derivable). Each new source = new `connectionType`.
- Handle the messy parts (see DATA-CONTRACT.md §"messiness"): CPF formatting, **CPF masking**
  (use Splink-style fuzzy match only for masked/name-only edges), encoding, schema drift.
- Bounded ego-expansion: cap hops/fan-out so files stay small and relevant.
- **GitHub Actions** cron: weekly run → emit all files → publish to CDN (or commit to repo).
- **Done when:** all ~594 politicians have validated JSON, refreshed automatically.

### Phase 4 — Frontend polish
- SSG: `web/src/app/politico/[id]/page.tsx` with `generateStaticParams` over the index →
  one pre-rendered, SEO-friendly page per politician.
- Home: search (Fuse.js) over the politician index; entity profile panels on node click.
- Filters: by category / connectionType. Empty/sparse-data states. Mobile.
- Disclaimers + source attribution visible on every page and edge (LEGAL.md).

### Phase 5 — Build-time AI enrichment (the RAG/agent learning track)
> Full design + hardware/model choices + rung-by-rung learning track: **`docs/AI-PLAN.md`**.
- Local **Gemma 4 12B** (Ollama) runs **in the pipeline**, not at request time:
  - Generate a plain-Portuguese summary per ego-network ("connected to N companies; one
    received R$X in contracts after a R$Y donation") — **templated + reviewable**, baked
    into `meta.summary` in the JSON.
  - Optional: NER / relationship hints from news to enrich `relative`/context edges.
- This teaches RAG (retrieve → ground → generate) and agent orchestration (plan → call
  tools → synthesize) as a **batch job**, for free, with no serving infra.
- **Legal note:** build-time generation means every sentence is reviewable before ship.
  Keep it factual/cited; no accusatory language. See LEGAL.md.

### Phase 6 — (Optional) Live AI endpoint
Only if a live, interactive agent is genuinely wanted. This is the one thing that needs a
backend (Next API route) **and** a hosted model (local Gemma can't serve the public).
Defer until v1 is real. Treat as a separate, isolated addition.

## 7. Data sources (seed list — verify against br-acc's registry)

| Source | Base URL (verify) | Gives us |
|---|---|---|
| Câmara dos Deputados | `https://dadosabertos.camara.leg.br/api/v2` | deputies, expenses, amendments |
| Senado Federal | `https://legis.senado.leg.br/dadosabertos` | senators |
| TSE (dados abertos) | `https://dadosabertos.tse.jus.br` | candidates, **campaign donations** |
| Receita Federal CNPJ | `https://dadosabertos.rfb.gov.br/CNPJ/` | companies + **QSA** (sócios) |
| Portal da Transparência | `https://api.portaldatransparencia.gov.br` | **contracts**, amendments, sanctions. br-acc uses **bulk CSVs (no key)**; the API path needs a free key. |

`pipeline/src/grafobr_pipeline/sources.py` holds the machine-readable registry. The
authoritative, complete list of URLs/field mappings lives in br-acc's source registry —
pull it from `reference/` once cloned.

## 8. Deployment
- **Frontend:** Vercel (free) or Cloudflare Pages. Static export.
- **Data:** committed JSON (simplest) or Cloudflare R2 (free tier) for larger volumes.
- **Pipeline:** GitHub Actions scheduled workflow. No always-on server anywhere.

## 9. Definition of done (v1)
A visitor can search a federal politician, land on a pre-rendered page, and explore an
interactive, source-attributed connection graph built from public data — with clear
"connections, not accusations" framing and disclaimers — all served as static files at ~$0.

## 10. Open questions (decide as you go)
- Family/`parente` edges: how far to trust derived relationships? (Lean conservative;
  it's the fuzziest + most legally sensitive data — see LEGAL.md.)
- Amendment→contract linkage: how directly can we connect a politician's amendment to a
  specific contract without overclaiming? (Show the chain, let users conclude.)
- CDN vs in-repo JSON once volume grows.
