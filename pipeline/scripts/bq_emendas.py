"""Pull individual parliamentary amendments (emendas individuais) for the current
mandate from Base dos Dados on BigQuery, aggregated by author + destination area.

Emendas individuais are the dominant way a deputy directs federal money. This writes
an emendas.csv keyed by author name (matched to our deputies in the pipeline) and
spending function (Saúde, Educação, Encargos especiais = the opaque "transferências
especiais", ...). Scoped to ano_emenda >= 2023 so it attributes cleanly to the sitting
mandate rather than a same-named predecessor.

  python scripts/bq_emendas.py
"""

from __future__ import annotations

import csv
from pathlib import Path

from google.cloud import bigquery

PROJECT = "grafobr-data"
OUT = Path(".cache/emendas/emendas.csv")
FROM_YEAR = 2023

SQL = """
SELECT
  nome_autor_emenda                      AS autor,
  sigla_uf_gasto                         AS uf,
  COALESCE(NULLIF(nome_funcao, ''), 'Não informado') AS funcao,
  ROUND(SUM(valor_empenhado))            AS empenhado,
  ROUND(SUM(valor_pago))                 AS pago,
  COUNT(*)                               AS n,
  MIN(ano_emenda)                        AS ano_min,
  MAX(ano_emenda)                        AS ano_max
FROM `basedosdados.br_cgu_emendas_parlamentares.microdados`
WHERE LOWER(tipo_emenda) LIKE '%individual%'
  AND ano_emenda >= @from_year
  AND nome_autor_emenda IS NOT NULL
GROUP BY autor, uf, funcao
HAVING empenhado > 0 OR pago > 0
"""


def main() -> int:
    client = bigquery.Client(project=PROJECT)
    job = client.query(
        SQL,
        job_config=bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("from_year", "INT64", FROM_YEAR)]
        ),
    )
    rows = list(job.result())
    gb = (job.total_bytes_processed or 0) / 1e9
    authors = len({r.autor for r in rows})
    print(f"emenda rows: {len(rows)}  authors: {authors}  (scanned {gb:.2f} GB)", flush=True)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["autor", "uf", "funcao", "empenhado", "pago", "n", "ano_min", "ano_max"])
        for r in rows:
            w.writerow([r.autor, r.uf or "", r.funcao, int(r.empenhado or 0),
                        int(r.pago or 0), r.n, r.ano_min, r.ano_max])
    print(f"wrote {OUT} ({len(rows)} rows)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
