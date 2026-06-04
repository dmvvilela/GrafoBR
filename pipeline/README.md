# GrafoBR — pipeline

Build-time ETL. Downloads public Brazilian data, joins it on CPF/CNPJ with **DuckDB**,
and emits one `{nodes,links}` JSON per federal politician (validated against
`../contract/ego-network.schema.json`). Runs locally and in GitHub Actions. **Not a
server** — it produces files and exits.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # add Portal da Transparência API key if/when needed
```

## Run

```bash
PYTHONPATH=src python -m grafobr_pipeline.run --limit 5
```

Phase 2 emits a small Câmara+TSE slice to `../data/<id>.json` plus
`../data/index.json`. Phase 3 expands this toward the full ~594-politician build.

The build caches Câmara API pages/details and TSE zip files under `.cache/`.
For larger slices, increase the Câmara detail pool explicitly:

```bash
PYTHONPATH=src python -m grafobr_pipeline.run --limit 50 --camara-detail-pool 150
```

Optional Receita/QSA `socio` edges require explicit local/scoped CSV inputs. The
pipeline does not download or ingest the full CNPJ base by default:

```bash
PYTHONPATH=src python -m grafobr_pipeline.receita slice-qsa \
  --empresas-input /path/to/Empresas0.zip \
  --socios-input /path/to/Socios0.zip \
  --target-cpf-file /path/to/seed-cpfs.txt \
  --output-dir .cache/receita-scoped

PYTHONPATH=src python -m grafobr_pipeline.run \
  --limit 5 \
  --cnpj-empresas-csv .cache/receita-scoped/receita_empresas_scoped.csv \
  --cnpj-socios-csv .cache/receita-scoped/receita_socios_scoped.csv
```

Receita masks partner CPFs in real `Socios` files. The QSA join supports exact
full-CPF rows and masked middle-six CPF rows only when the partner name also
matches the deputy's known public/civil name. It does not infer family edges.

## Modules

```
src/grafobr_pipeline/
  sources.py             # registry of data sources (base URLs, keys). SEED it from br-acc.
  build_ego_networks.py  # the core: seed on politicians, expand bounded ego-networks (DuckDB)
  emit.py                # write + validate one EgoNetwork file against the contract schema
  run.py                 # orchestrate: download → build → emit
```

## The approach (see ../docs/PLAN.md Phase 2–3, ../docs/DATA-CONTRACT.md)

1. **Seed** on the ~594 sitting federal deputies + senators (Câmara + Senado).
2. **Expand** each seed ~1–2 hops via DuckDB joins:
   - TSE donations → `doacao` edges (donor → politician)
   - Receita QSA → `socio` edges (politician/relative ↔ company)
   - Portal da Transparência contracts → `contrato` edges
3. **Assign integer node ids.** Keep the CPF/CNPJ ↔ id map **private to the build** — it
   never ends up in the emitted files (privacy + legal; see ../docs/LEGAL.md).
4. **Compute `connectionCount`** (degree) per node.
5. **Emit + validate** one file per politician.

## br-acc reference
Clone br-acc into `../reference/` (see `../reference/README.md`) and read its **source
registry** + ETL modules to get the authoritative base URLs and field mappings.
**Study, don't copy** — br-acc is AGPL; our code is MIT (../docs/LEGAL.md#agpl-boundary).

## Messiness to expect
CPF masking (LGPD redaction → fuzzy match only where forced), CPF/CNPJ formatting,
encoding (latin-1 vs utf-8), schema drift across portals. Details in
../docs/DATA-CONTRACT.md §"messiness".
