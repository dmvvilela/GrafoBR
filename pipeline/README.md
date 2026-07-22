# GrafoBR — pipeline

Build-time ETL. Produces one static `{nodes,links}` JSON per federal deputy in `../data/`,
with three edge types:

| edge | meaning | source |
|---|---|---|
| `doacao` | campaign donor → deputy | **TSE** 2022 (bulk CSV) |
| `socio` | deputy co-owns a company | **Receita CNPJ / QSA** (per-file download) |
| `contrato` | that company won a federal contract | **BigQuery / Base dos Dados** (no WAF) |

It's not a server — it runs, writes files, and exits. The frontend reads the files.

---

## TL;DR — build everything (local)

Data refresh runs **on your machine**, not in CI. The Receita CNPJ download (~2.5 GB)
is cached in `pipeline/.cache/` after the first run; GitHub Actions would re-fetch it
every time (see **GitHub Actions** below).

```bash
# one-time setup (see sections below)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt google-cloud-bigquery db-dtypes
python scripts/download_cnpj_files.py     # ~2.5GB CNPJ shards (Empresas+Sócios); skipped if cached
gcloud auth application-default login     # for contracts + emendas via BigQuery

# build (donations + socio + contracts + emendas) -> ../data/*.json
bash scripts/build_all.sh 512             # 512 = current Câmara API population

# sync derived indexes into the site + deploy
cd ../web && pnpm sync-data && pnpm dev    # predev runs sync-data automatically

# when ready to ship:
git add web/public/data && git commit -m "chore: refresh data snapshot" && git push
```

### Obras públicas (`/obras` page)

Separate from deputy ego-networks — federal infra projects from **Obrasgov.br**:

```bash
PYTHONPATH=src .venv/bin/python scripts/fetch_obras.py --pages-per-query 2 --skip-financial
# ~12 min; discovers ~500 projects via UF×situação matrix (API pagination is broken)
cd ../web && pnpm sync-data
```

Full run with empenhos: drop `--skip-financial` (much slower).

---

## How we get each source (and the gotchas)

### Câmara dos Deputados — deputies (seed)
Public REST API (`dadosabertos.camara.leg.br/api/v2`). Fetched + **cached** to `.cache/camara/`
with retries. Photos resolve from the id: `camara.leg.br/internet/deputado/bandep/{id}.jpg`.

### TSE — campaign donations (`doacao`)
Bulk yearly ZIPs from `cdn.tse.jus.br`. Downloaded once to `.cache/downloads/`; receipts are
streamed and filtered to the matched candidates. Handled by `tse.py` — no setup needed.

### Receita CNPJ / QSA — company ownership (`socio`)
**Gotcha:** the Nextcloud share's whole-folder download ignores the file param and streams the
**entire ~44GB Receita tree** (CAFIR, everything) as a truncated, unextractable zip. **Don't.**
Instead download per-file via the WebDAV path (`scripts/download_cnpj_files.py`, ~1.6GB):
```
https://arquivos.receitafederal.gov.br/public.php/dav/files/<token>/Dados/Cadastros/CNPJ/2023-05/{Empresas,Socios}{0-9}.zip
```
Then `slice-qsa` scopes them to our deputies' CPFs (**masked middle-6 + name** match, since
Receita masks the partner CPF). Current release: **2023-05** (what the share hosts).

### Federal contracts (`contrato`) — via BigQuery
**Gotcha:** the Portal da Transparência bulk download is behind **AWS WAF "Human Verification"**
— curl/httpx get a challenge page, not data. **Use BigQuery instead** (see setup below):
`scripts/bq_contracts.py` queries `basedosdados.br_cgu_licitacao_contrato.contrato_compra`
for our companies' CNPJ roots → `contratos.csv`. No WAF, ~0GB scanned, free tier.

---

## BigQuery setup (one-time — needed for contracts)

Base dos Dados mirrors Brazilian public data on BigQuery, so we query it directly (no portal,
no WAF, only the matching rows). It's **free** — 1 TB scanned/month, our queries use ~MB — and
needs **no credit card** (a project without billing runs in BigQuery *sandbox*).

```bash
# 1. Have/create a GCP project (IDs are globally unique):
gcloud projects create grafobr-data        # or use an existing one
gcloud config set project grafobr-data
gcloud services enable bigquery.googleapis.com

# 2. Application Default Credentials (what the Python client uses — NOT `gcloud auth login`):
gcloud auth application-default login
gcloud auth application-default set-quota-project grafobr-data
```
Then `scripts/bq_contracts.py` works. Useful tables on `basedosdados`:
`br_cgu_licitacao_contrato.contrato_compra` (contracts), `br_me_cnpj.socios` (sócios — could
replace the local download), `br_cgu_emendas_parlamentares` (amendments — future).

### GitHub Actions (optional — off by default)

The `refresh-data` workflow (`.github/workflows/refresh-data.yml`) mirrors `build_all.sh`
and can commit the snapshot back to the repo. **We don't use it day-to-day** — refresh
locally (above) and push `web/public/data/` yourself.

Why local-first: each CI run starts with an empty disk, so it re-downloads ~2.5 GB of
Receita CNPJ shards and burns 30–60+ Action minutes. BigQuery is cheap (~MB/run); the
Receita re-download is the cost.

The monthly **cron is commented out** on purpose. To enable later (e.g. once caching or
budget makes sense): uncomment the `schedule` block, set repo secret **`GCP_SA_KEY`**
(service-account JSON with `roles/bigquery.user` on `grafobr-data`), then
**Actions → refresh-data → Run workflow** to test.

Local BigQuery auth (what you use now):

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project grafobr-data
```

---

## Modules & scripts
```
src/grafobr_pipeline/
  run.py                 # CLI: --limit, --cnpj-*-csv, --contratos-csv
  build_ego_networks.py  # seed on deputies, expand bounded ego-networks (DuckDB)
  camara.py  tse.py      # source fetchers (cached, retried)
  receita.py             # CNPJ release resolver + slice-qsa (masked-CPF match)
  transparencia.py       # contracts CSV reader (fed by BigQuery output)
  emit.py                # write + validate each file against ../contract schema
scripts/
  download_cnpj_files.py # per-file Receita CNPJ download (~1.6GB)
  extract_target_cpfs.py # deputies' CPFs from the Câmara cache (stay local)
  bq_contracts.py        # federal contracts via BigQuery
  build_all.sh           # the whole flow, one command
  fetch_obras.py         # Obrasgov.br → ../data/_obras.json (standalone /obras page)
  salvage_cnpj.py        # diagnose/carve a truncated whole-folder zip (legacy/forensic)
```

## Caveats (the data is "leads, not proof")
- Sócios are **2023-05** vintage; contracts are **federal-executive only** (no state/municipal).
- The socio match is **masked-CPF middle-6 + name** — strong, but verify each lead (a rare
  namesake collision is possible). Tightening with UF/birth-year is a TODO.
- Câmara is authoritative for who gets a profile. TSE is optional enrichment, so a
  current deputy without a 2022 candidate/receipt match is still emitted with no donation edge.
- `--limit` must be ≤ the current number returned by Câmara (currently **512**), or the build errors.

## Cache & cleanup
All downloads/intermediates live in `.cache/` (**gitignored**). To reclaim disk or rebuild
from scratch:
```bash
rm -rf .cache          # re-download with download_cnpj_files.py + re-run build_all.sh
```
`.cache/cnpj/members/` (~1.6 GB) is the only piece you must re-download; everything else
regenerates.
