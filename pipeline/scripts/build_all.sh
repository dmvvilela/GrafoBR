#!/usr/bin/env bash
# Full GrafoBR data build: donations + company-ownership (socio) + federal contracts
# -> ../data/*.json. One command; re-runs are mostly cached.
#
# Prereqs (see pipeline/README.md):
#   - .venv with `pip install -r requirements.txt google-cloud-bigquery db-dtypes`
#   - CNPJ shards downloaded:  python scripts/download_cnpj_files.py   (~1.6GB, one-time)
#   - BigQuery auth (for contracts): gcloud auth application-default login + a project
#
# Usage:  bash scripts/build_all.sh [LIMIT]      (LIMIT defaults to 512 = TSE-matched ceiling)
set -euo pipefail
cd "$(dirname "$0")/.."   # -> pipeline/
LIMIT="${1:-512}"
run() { PYTHONPATH=src .venv/bin/python "$@"; }

echo "[1/6] donations build ($LIMIT deputies; Câmara+TSE, cached)..."
run -m grafobr_pipeline.run --limit "$LIMIT" | tail -1

echo "[2/6] extract target CPFs (stay local)..."
run scripts/extract_target_cpfs.py

echo "[3/6] slice Sócios/Empresas for the matched deputies..."
args=()
for f in .cache/cnpj/members/Empresas*.zip; do args+=(--empresas-input "$f"); done
for f in .cache/cnpj/members/Socios*.zip;   do args+=(--socios-input "$f");   done
run -m grafobr_pipeline.receita slice-qsa "${args[@]}" \
  --target-cpf-file .cache/cnpj/target_cpfs.txt --output-dir .cache/cnpj/scoped | tail -1

echo "[4/6] company roots..."
cut -d',' -f1 .cache/cnpj/scoped/receita_socios_scoped.csv | tail -n +2 | sort -u \
  > .cache/cnpj/our_roots.txt

echo "[5/6] federal contracts via BigQuery (no WAF)..."
# no `|| true`: a BigQuery auth/network failure must abort the build (set -e), not
# silently leave a stale/empty contratos.csv.
PYTHONWARNINGS=ignore .venv/bin/python scripts/bq_contracts.py

echo "[6/6] full rebuild with socio + contrato..."
run -m grafobr_pipeline.run --limit "$LIMIT" \
  --cnpj-empresas-csv .cache/cnpj/scoped/receita_empresas_scoped.csv \
  --cnpj-socios-csv   .cache/cnpj/scoped/receita_socios_scoped.csv \
  --contratos-csv     .cache/cnpj/scoped/contratos.csv | tail -1

echo "[meta] stamp data freshness (-> ../data/_meta.json)..."
run scripts/write_meta.py

echo "=== edge counts ==="
grep -oh '"connectionType": "[a-z]*"' ../data/*.json | sort | uniq -c
echo "done -> ../data/*.json. View it:  cd ../web && pnpm dev"
