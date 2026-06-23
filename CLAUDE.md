# CLAUDE.md — orientation for the implementing model

You're picking up a **scaffold**. Nothing is implemented; the structure, the data
contract, and a detailed plan are in place. Your job is to implement it phase by phase.

## Before you write code, read (in order)
1. `docs/PLAN.md` — the phased build plan. **Start at Phase 1.**
2. `docs/DECISIONS.md` — the reasoning behind every locked choice. These were debated
   at length with the user. **Do not relitigate them** unless the user asks.
3. `docs/DATA-CONTRACT.md` + `contract/` — the JSON seam both halves depend on.
4. `docs/LEGAL.md` — non-negotiable constraints. This project touches living, litigious
   public figures. The framing is "surfaces connections," never "accuses."
5. `docs/DATA-FEASIBILITY.md` — **read before building `pipeline/`.** Which br-acc ETL
   modules are real vs stubs, the minimum source set, and what's actually new work.

## The mental model (so you don't get lost)
- **Two halves, one seam.** `pipeline/` (Python+DuckDB) produces `{nodes,links}` JSON;
  `web/` (Next.js+D3) renders it. They meet only at `contract/ego-network.schema.json`.
- **Everything is static.** No runtime backend in v1. The pipeline runs at build time
  (GitHub Actions), emits files, done.
- **Scope is small on purpose:** ~600 federal politicians, each a bounded "ego-network."
  Not the whole 83M-node graph.

## Locked constraints (from DECISIONS.md — honor these)
- Frontend: **Next.js** (App Router) + **D3/d3-force** + **Tailwind**, package manager **pnpm**.
- Build: **DuckDB** in Python. Output: static JSON. No live DB in v1.
- AI (later phase): **build-time only**, local **Gemma 4 12B** via Ollama, results baked
  into the JSON. No live AI endpoint in v1 (also a legal safeguard).
- **Never import `br-acc` code into our codebase** (AGPL). Study it in `reference/`,
  reimplement clean. Its value to us = the data-source base URLs + normalization approach.

## Current state (updated 2026-06-04)
- **Phase 1 (web graph): DONE.** `NetworkGraph.tsx` is a real D3 force graph. Builds clean.
- **Phase 2 (pipeline doação): DONE.** Câmara (cached, retried) + TSE 2022 → real `doacao`
  ego-networks. 5 deputies emitted + validated.
- **Phase 3 (pipeline socio + contrato): LOGIC DONE, not yet run for real.**
  - `socio` (Receita QSA) handles **masked CPFs** (middle-6 + name match) — tested.
  - `contrato` (Transparência) attaches only to companies already in the network — tested.
  - QSA source slicer scopes the Receita dump. All offline `unittest`s pass (5/5).
  - NOT yet validated against a real Receita/Transparência download, and live output is
    still only 5 deputies, `doacao`-only.
- **Phase 4 (frontend): DONE.** Dark themed site, deputy directory (Fuse search), SSG
  `/politico/[id]` pages, detail panel, disclaimers. Builds; prerenders real deputy pages.
- **Phase 5 (AI): not started.** `ai/summarize.py` exists (steps 1–2) but untested.

## Division of labor so far
Codex drove the pipeline (Phases 2–3); Claude drove the frontend (Phase 4) + reviews.

## How to refresh data + view the site (run when the machine is free)
```bash
# doação-only, scale up (TSE + Câmara are cached):
cd pipeline && PYTHONPATH=src .venv/bin/python -m grafobr_pipeline.run --limit 513
cd ../web && pnpm dev          # predev auto-copies data/ -> public/data; open :3000
```
For `socio`/`contrato` edges you must first produce scoped Receita/Transparência CSVs
(download + slice) and pass `--cnpj-*` / `--contratos-csv` flags — that's the heavy run.

## Next priorities
1. A real Receita/Transparência run to confirm `socio`/`contrato` on live data.
2. Scale `doacao` to all 513 deputies.
3. Frontend: deploy + decide the data-on-deploy strategy (commit snapshot vs CI build).
