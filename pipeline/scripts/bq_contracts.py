"""Pull federal contracts for our deputies' companies from Base dos Dados on BigQuery
(bypasses the Portal da Transparência AWS WAF). Writes a contratos.csv in the format
transparencia.iter_contracts_csv expects, scoped to .cache/cnpj/our_roots.txt.

  python scripts/bq_contracts.py
"""

from __future__ import annotations

import csv
from pathlib import Path

from google.cloud import bigquery

PROJECT = "grafobr-data"
ROOTS = Path(".cache/cnpj/our_roots.txt")
OUT = Path(".cache/cnpj/scoped/contratos.csv")

SQL = """
SELECT
  cpf_cnpj_contratado AS cnpj,
  nome_contratado     AS razao_social,
  objeto,
  COALESCE(valor_final_compra, valor_inicial_compra) AS valor,
  nome_orgao          AS orgao,
  CAST(data_assinatura_contrato AS STRING) AS data_inicio
FROM `basedosdados.br_cgu_licitacao_contrato.contrato_compra`
WHERE SUBSTR(REGEXP_REPLACE(cpf_cnpj_contratado, r'[^0-9]', ''), 1, 8) IN UNNEST(@roots)
"""


def brl(value) -> str:
    # comma-decimal, no thousands sep -> parse_brl reads it back as a float
    if value is None:
        return ""
    return f"{float(value):.2f}".replace(".", ",")


def main() -> int:
    roots = [r.strip() for r in ROOTS.read_text().splitlines() if r.strip()]
    print(f"{len(roots)} company roots", flush=True)

    client = bigquery.Client(project=PROJECT)
    job = client.query(
        SQL,
        job_config=bigquery.QueryJobConfig(
            query_parameters=[bigquery.ArrayQueryParameter("roots", "STRING", roots)]
        ),
    )
    rows = list(job.result())
    gb = (job.total_bytes_processed or 0) / 1e9
    print(f"contracts matched: {len(rows)}  (scanned {gb:.2f} GB)", flush=True)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            ["cnpj_contratada", "razao_social", "objeto", "valor", "orgao_contratante", "data_inicio"]
        )
        for r in rows:
            w.writerow([r.cnpj, r.razao_social, r.objeto, brl(r.valor), r.orgao, r.data_inicio])
    print(f"wrote {OUT} ({len(rows)} rows)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
