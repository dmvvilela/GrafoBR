# GrafoBR

**An open, static graph of Brazilian federal politicians and their public-data connections.**

GrafoBR takes Brazil's already-public government data (campaign donations, company
ownership, public contracts) and turns it into a navigable connection graph — one
"ego-network" per federal deputy and senator. It surfaces *connections*; it does **not**
accuse anyone of anything. (Read [`docs/LEGAL.md`](docs/LEGAL.md) before doing anything public.)

> **Status:** 🚧 Scaffold only. Nothing is implemented yet. This repo is a structured
> starting point + a detailed plan for the implementing model/dev. See
> [`docs/PLAN.md`](docs/PLAN.md).

---

## The one-paragraph architecture

Government data is essentially static (it updates daily/weekly). So we **precompute**:
a Python + DuckDB pipeline runs in CI, joins the public datasets on **CPF/CNPJ**, and
emits one static `{ nodes, links }` JSON file per politician. A Next.js frontend renders
those files with a D3 force-directed graph. **No runtime backend, no database to host —
just static files on a CDN.** Cost: ~$0.

```
 pipeline (Python + DuckDB, in GitHub Actions)
        │  joins public data on CPF/CNPJ, scoped to ~600 federal politicians
        ▼
 contract: { nodes, links } JSON   ◄── the single seam between the two halves
        ▼
 web (Next.js + D3)  →  static per-politician pages  →  Vercel (free)
```

The **data contract** ([`contract/`](contract/)) is the heart of the project: the two
halves are built independently and only have to agree on that JSON shape.

## Repo layout

| Path | What | Language / stack |
|---|---|---|
| [`web/`](web/) | Frontend — graph, search, politician pages | Next.js, TS, Tailwind, D3 |
| [`pipeline/`](pipeline/) | ETL — builds the JSON from public data | Python, DuckDB |
| [`contract/`](contract/) | **The seam** — JSON Schema + sample fixture | JSON Schema |
| [`data/`](data/) | Generated `{nodes,links}` output (gitignored) | — |
| [`reference/`](reference/) | `br-acc` cloned here for study (gitignored, **not vendored**) | — |
| [`docs/`](docs/) | Plan, decisions, legal, contract docs | Markdown |

## Quickstart

```bash
# Frontend (works today with the synthetic sample once NetworkGraph is implemented)
cd web && pnpm install && pnpm dev

# Pipeline (not implemented yet — see pipeline/README.md)
cd pipeline && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

## Read next

1. [`docs/PLAN.md`](docs/PLAN.md) — the full build plan, phase by phase
2. [`docs/DECISIONS.md`](docs/DECISIONS.md) — why every major choice was made (don't relitigate)
3. [`docs/DATA-CONTRACT.md`](docs/DATA-CONTRACT.md) — the JSON shape + how pipeline data maps onto it
4. [`docs/LEGAL.md`](docs/LEGAL.md) — the constraints that keep this defensible

## License

Code in `web/` and `pipeline/`: **MIT** (our own code).
We **do not** vendor `br-acc` code (it's AGPL-3.0). See [`docs/LEGAL.md`](docs/LEGAL.md#agpl-boundary).
