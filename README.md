# GrafoBR

**An open, static graph of Brazilian federal deputies and their public-data connections.**

GrafoBR joins Brazil's already-public government data — campaign donations, company
ownership, public contracts — into one navigable connection graph per federal deputy.
It makes the **money trail visible** so a person can follow it: who funded a deputy, what
companies they co-own, and which of those companies won federal contracts.

> ⚖️ **It surfaces connections from public records — it does not accuse anyone.** A shared
> name in two datasets is a *lead to investigate*, never proof of wrongdoing. Read
> [`docs/LEGAL.md`](docs/LEGAL.md) before deploying anything public.

## What it shows

Each deputy's page is an interactive graph of three edge types, drawn from public data:

| edge | meaning | source |
|---|---|---|
| **doação** | a campaign donor → the deputy | TSE (2022) |
| **sócio** | the deputy co-owns a company | Receita Federal (CNPJ / QSA) |
| **contrato** | that company won a federal contract | Base dos Dados / BigQuery |

The interesting signal is the **chain**: a deputy who co-owns a company that won a public
contract. That pattern is rare and worth a journalist's attention — exactly what the tool
makes findable.

Current build: **512 sitting deputies**, ~7.4k donation + ~1.1k ownership + a handful of
contract edges, served as static files. *(Sócios are the 2023-05 Receita release; contracts
are federal-executive only — so this is a floor, not a ceiling, of what's there.)*

## How it works

Government data is essentially static, so we **precompute**: a Python + **DuckDB** pipeline
joins the sources on **CPF/CNPJ** (matching masked CPFs by middle-6 + name + age bracket),
and emits one `{ nodes, links }` JSON per deputy. A Next.js + D3 frontend renders them.
**No runtime backend, no database to host — just static files.** Cost: ~$0.

```
 Câmara · TSE · Receita CNPJ · BigQuery
        │  Python + DuckDB — join on CPF/CNPJ (build-time)
        ▼
 { nodes, links } JSON per deputy   ◄── the data contract (the seam)
        │
        ▼
 Next.js + D3  →  static SSG pages  →  Vercel
```

The **data contract** ([`contract/`](contract/)) is the seam: the pipeline and the frontend
are built independently and only agree on that JSON shape.

## Quickstart

```bash
# View the site — the data snapshot is committed, so this just works:
cd web && pnpm install && pnpm dev          # http://localhost:3000

# Rebuild the data (needs CNPJ download + BigQuery auth — see pipeline/README.md):
cd pipeline && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt google-cloud-bigquery db-dtypes
python scripts/download_cnpj_files.py        # ~1.6GB, one-time
gcloud auth application-default login        # for contracts via BigQuery
bash scripts/build_all.sh 512                # -> ../data/*.json
```

Deploy: `cd web && vercel` (Next.js SSG — Vercel serves it natively, no CI needed).

## Repo layout

| Path | What | Stack |
|---|---|---|
| [`web/`](web/) | Frontend — directory, graph, deputy pages | Next.js, TS, Tailwind, D3 |
| [`pipeline/`](pipeline/) | ETL — builds the JSON from public data ([README](pipeline/README.md)) | Python, DuckDB, BigQuery |
| [`contract/`](contract/) | The seam — JSON Schema + sample | JSON Schema |
| [`web/public/data/`](web/public/data/) | Committed data snapshot (what Vercel serves) | — |
| [`docs/`](docs/) | Decisions, legal, data feasibility, AI plan | Markdown |
| `reference/` | `br-acc` cloned for study (gitignored, **not vendored** — it's AGPL) | — |

## Read next

1. [`pipeline/README.md`](pipeline/README.md) — how each data source is fetched (+ the gotchas: Receita's 44 GB dead end, the Transparência WAF → BigQuery)
2. [`docs/LEGAL.md`](docs/LEGAL.md) — the "connections, not accusations" constraints
3. [`docs/DECISIONS.md`](docs/DECISIONS.md) — why every major choice was made
4. [`docs/DATA-CONTRACT.md`](docs/DATA-CONTRACT.md) — the `{nodes,links}` shape

## License

Our code (`web/`, `pipeline/`): **MIT**. We study but never vendor `br-acc` (AGPL-3.0) —
see [`docs/LEGAL.md`](docs/LEGAL.md#agpl-boundary). All data shown is public by law.
