"""Pull individual parliamentary amendments (emendas individuais) for the current
mandate from Base dos Dados on BigQuery.

Emendas individuais are the dominant way a deputy directs federal money. This writes
an emendas.csv keyed by author name (matched to our deputies in the pipeline) and
spending function (Saúde, Educação, Encargos especiais = the opaque "transferências
especiais", ...). Scoped to ano_emenda >= 2023 so it attributes cleanly to the sitting
mandate rather than a same-named predecessor.

It also emits a detailed destination artifact for downstream "lead" generation
(municipality/action/function evidence). Those details are intentionally kept out of
the ego-network graph contract; consumers must label them as documentary leads, not
proof of responsibility for any project.

  python scripts/bq_emendas.py
"""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from google.cloud import bigquery

PROJECT = "grafobr-data"
OUT = Path(".cache/emendas/emendas.csv")
OUT_DEST_CSV = Path(".cache/emendas/emenda_destinations.csv")
OUT_DEST_JSON = Path(__file__).resolve().parents[2] / "data" / "_emenda-destinations.json"
FROM_YEAR = 2023

AGG_SQL = """
SELECT
  nome_autor_emenda                      AS autor,
  id_autor_emenda                        AS autor_id,
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
GROUP BY autor, autor_id, uf, funcao
HAVING empenhado > 0 OR pago > 0
"""

DEST_SQL = """
SELECT
  e.nome_autor_emenda                      AS autor,
  e.id_autor_emenda                        AS autor_id,
  e.sigla_uf_gasto                         AS uf,
  e.id_municipio_gasto                     AS codigo_municipio,
  m.nome                                   AS municipio,
  e.localidade                             AS localidade,
  COALESCE(NULLIF(e.nome_funcao, ''), 'Não informado') AS funcao,
  COALESCE(NULLIF(e.nome_subfuncao, ''), 'Não informado') AS subfuncao,
  e.id_acao                                AS acao_id,
  COALESCE(NULLIF(e.nome_acao, ''), 'Não informado') AS acao,
  ROUND(SUM(e.valor_empenhado))            AS empenhado,
  ROUND(SUM(e.valor_pago))                 AS pago,
  COUNT(DISTINCT e.id_emenda)              AS emendas,
  COUNT(*)                               AS row_count,
  MIN(e.ano_emenda)                        AS ano_min,
  MAX(e.ano_emenda)                        AS ano_max,
  ARRAY_AGG(DISTINCT e.id_emenda IGNORE NULLS LIMIT 5) AS sample_ids
FROM `basedosdados.br_cgu_emendas_parlamentares.microdados` e
LEFT JOIN `basedosdados.br_bd_diretorios_brasil.municipio` m
  ON e.id_municipio_gasto = m.id_municipio
WHERE LOWER(e.tipo_emenda) LIKE '%individual%'
  AND e.ano_emenda >= @from_year
  AND e.nome_autor_emenda IS NOT NULL
GROUP BY
  autor,
  autor_id,
  uf,
  codigo_municipio,
  municipio,
  localidade,
  funcao,
  subfuncao,
  acao_id,
  acao
HAVING empenhado > 0 OR pago > 0
"""


def run_query(client: bigquery.Client, sql: str) -> tuple[list, float]:
    job = client.query(
        sql,
        job_config=bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("from_year", "INT64", FROM_YEAR)
            ]
        ),
    )
    rows = list(job.result())
    gb = (job.total_bytes_processed or 0) / 1e9
    return rows, gb


def main() -> int:
    client = bigquery.Client(project=PROJECT)
    rows, gb = run_query(client, AGG_SQL)
    authors = len({r.autor for r in rows})
    print(f"emenda rows: {len(rows)}  authors: {authors}  (scanned {gb:.2f} GB)", flush=True)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["autor", "autor_id", "uf", "funcao", "empenhado", "pago", "n", "ano_min", "ano_max"])
        for r in rows:
            w.writerow([r.autor, r.autor_id or "", r.uf or "", r.funcao, int(r.empenhado or 0),
                        int(r.pago or 0), r.n, r.ano_min, r.ano_max])
    print(f"wrote {OUT} ({len(rows)} rows)", flush=True)

    dest_rows, dest_gb = run_query(client, DEST_SQL)
    dest_authors = len({r.autor for r in dest_rows})
    print(
        f"emenda destination rows: {len(dest_rows)}  authors: {dest_authors}  "
        f"(scanned {dest_gb:.2f} GB)",
        flush=True,
    )

    OUT_DEST_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_DEST_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "autor",
                "autor_id",
                "uf",
                "codigo_municipio",
                "municipio",
                "localidade",
                "funcao",
                "subfuncao",
                "acao_id",
                "acao",
                "empenhado",
                "pago",
                "emendas",
                "row_count",
                "ano_min",
                "ano_max",
                "sample_ids",
            ]
        )
        for r in dest_rows:
            w.writerow(
                [
                    r.autor,
                    r.autor_id or "",
                    r.uf or "",
                    r.codigo_municipio or "",
                    r.municipio or "",
                    r.localidade or "",
                    r.funcao,
                    r.subfuncao,
                    r.acao_id or "",
                    r.acao,
                    int(r.empenhado or 0),
                    int(r.pago or 0),
                    int(r.emendas or 0),
                    int(r.row_count or 0),
                    r.ano_min,
                    r.ano_max,
                    ";".join(r.sample_ids or []),
                ]
            )
    print(f"wrote {OUT_DEST_CSV} ({len(dest_rows)} rows)", flush=True)

    payload = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "basedosdados.br_cgu_emendas_parlamentares.microdados",
            "fromYear": FROM_YEAR,
            "note": (
                "Emendas individuais agrupadas por autor, UF, municipio, funcao, "
                "subfuncao e acao. Use como evidencia documental para leads; nao "
                "prova execucao, responsabilidade ou relacao causal com obras."
            ),
        },
        "rows": [
            {
                "autor": r.autor,
                "autorId": r.autor_id or None,
                "uf": r.uf or None,
                "codigoMunicipio": r.codigo_municipio or None,
                "municipio": r.municipio or None,
                "localidade": r.localidade or None,
                "funcao": r.funcao,
                "subfuncao": r.subfuncao,
                "acaoId": r.acao_id or None,
                "acao": r.acao,
                "empenhado": int(r.empenhado or 0),
                "pago": int(r.pago or 0),
                "emendas": int(r.emendas or 0),
                "rowCount": int(r.row_count or 0),
                "anoMin": r.ano_min,
                "anoMax": r.ano_max,
                "sampleIds": list(r.sample_ids or []),
            }
            for r in dest_rows
        ],
    }
    OUT_DEST_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_DEST_JSON.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {OUT_DEST_JSON} ({len(dest_rows)} rows)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
