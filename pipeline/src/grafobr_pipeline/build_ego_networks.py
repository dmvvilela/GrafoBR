"""Core build: seed on federal politicians and emit bounded ego-networks.

Phase 2 implementation: Câmara current deputies + TSE 2022 campaign receipts.
This produces real `doacao` edges for a small, validated slice while keeping all
CPF/CNPJ-like identifiers inside the build.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, Union

import duckdb

from .camara import Deputy, fetch_current_deputies
from .emit import emit
from .receita import iter_empresas_csv, iter_socios_csv
from .tse import iter_receipts_for_candidates, prepare_2022_files


@dataclass
class BuildContext:
    output_dir: str = "../data"
    cache_dir: str = ".cache"
    max_hops: int = 1
    max_fanout: int = 25
    limit: int = 5
    camara_detail_pool: Optional[int] = None
    cnpj_empresas_csv: Optional[str] = None
    cnpj_socios_csv: Optional[str] = None


def _digits(value: Optional[str], width: Optional[int] = None) -> Optional[str]:
    if not value:
        return None
    digits = "".join(char for char in str(value) if char.isdigit())
    if not digits:
        return None
    return digits.zfill(width) if width else digits


def _normalize_name(value: Optional[str]) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFKD", value)
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"[^A-Za-z0-9]+", " ", text).strip().lower()
    return re.sub(r"\s+", " ", text)


def _hash_key(prefix: str, value: str) -> str:
    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}:{digest}"


def _parse_amount(value: Optional[str]) -> float:
    if not value:
        return 0.0
    normalized = value.strip().replace(".", "").replace(",", ".")
    try:
        return float(normalized)
    except ValueError:
        return 0.0


def _parse_tse_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%d/%m/%Y").date().isoformat()
    except ValueError:
        return None


def _format_tse_date(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        return value


def _money(value: float) -> str:
    formatted = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R${formatted}"


def load_seed_politicians(
    con: duckdb.DuckDBPyConnection,
    *,
    cache_dir: str = ".cache",
    detail_limit: Optional[int] = None,
) -> list[dict[str, Any]]:
    """Load sitting federal deputies from Câmara Dados Abertos into DuckDB."""

    deputies = fetch_current_deputies(cache_dir, detail_limit=detail_limit)
    con.execute(
        """
        create or replace table camara_deputies (
          camara_id integer,
          name varchar,
          civil_name varchar,
          cpf varchar,
          normalized_name varchar,
          party varchar,
          uf varchar,
          email varchar
        )
        """
    )
    con.executemany(
        """
        insert into camara_deputies
        values (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                deputy.camara_id,
                deputy.name,
                deputy.civil_name,
                deputy.cpf,
                _normalize_name(deputy.name),
                deputy.party,
                deputy.uf,
                deputy.email,
            )
            for deputy in deputies
        ],
    )
    return [_deputy_to_dict(deputy) for deputy in deputies]


def normalize_keys(con: duckdb.DuckDBPyConnection) -> None:
    """Phase 2 keys are normalized before insertion; keep a hook for Phase 3."""

    con.execute(
        """
        create or replace temp view normalized_camara_deputies
        as select * from camara_deputies
        """
    )


def _deputy_to_dict(deputy: Deputy) -> dict[str, Any]:
    return {
        "camara_id": deputy.camara_id,
        "name": deputy.name,
        "civil_name": deputy.civil_name,
        "cpf": deputy.cpf,
        "normalized_name": _normalize_name(deputy.name),
        "party": deputy.party,
        "uf": deputy.uf,
        "email": deputy.email,
    }


def _load_tse_candidates(con: duckdb.DuckDBPyConnection, candidates_csv: Path) -> int:
    rows: list[tuple[Any, ...]] = []
    with candidates_csv.open("r", encoding="latin-1", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        for row in reader:
            if row.get("DS_CARGO") != "DEPUTADO FEDERAL":
                continue
            cpf = _digits(row.get("NR_CPF_CANDIDATO"), 11)
            if cpf in {None, "00000000004"}:
                cpf = None
            name = row.get("NM_URNA_CANDIDATO") or row.get("NM_CANDIDATO") or ""
            rows.append(
                (
                    row.get("SQ_CANDIDATO"),
                    cpf,
                    name,
                    row.get("NM_CANDIDATO"),
                    _normalize_name(name),
                    row.get("SG_PARTIDO"),
                    row.get("SG_UF"),
                    row.get("DS_SIT_TOT_TURNO"),
                )
            )

    con.execute(
        """
        create or replace table tse_candidates (
          sq_candidate varchar,
          cpf varchar,
          ballot_name varchar,
          full_name varchar,
          normalized_name varchar,
          party varchar,
          uf varchar,
          result varchar
        )
        """
    )
    con.executemany("insert into tse_candidates values (?, ?, ?, ?, ?, ?, ?, ?)", rows)
    return len(rows)


def _matched_candidates(con: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    rows = con.execute(
        """
        select
          d.camara_id,
          d.name,
          d.civil_name,
          d.cpf,
          d.party,
          d.uf,
          c.sq_candidate,
          c.ballot_name,
          c.full_name,
          c.result
        from camara_deputies d
        join tse_candidates c
          on (d.cpf is not null and d.cpf = c.cpf)
          or (
            d.cpf is null
            and d.normalized_name <> ''
            and d.normalized_name = c.normalized_name
          )
        qualify row_number() over (
          partition by d.camara_id
          order by
            case when d.cpf is not null and d.cpf = c.cpf then 0 else 1 end,
            c.result
        ) = 1
        order by d.name
        """
    ).fetchall()
    columns = [column[0] for column in con.description]
    return [dict(zip(columns, row)) for row in rows]


def _load_tse_receipts(
    con: duckdb.DuckDBPyConnection, receipts_zip: Path, candidate_ids: set[str]
) -> int:
    con.execute(
        """
        create or replace table tse_receipts (
          sq_candidate varchar,
          donor_key varchar,
          donor_name varchar,
          receipt_date varchar,
          amount double
        )
        """
    )

    rows: list[tuple[str, str, str, Optional[str], float]] = []
    for row in iter_receipts_for_candidates(receipts_zip, candidate_ids):
        donor_doc = _digits(row.get("NR_CPF_CNPJ_DOADOR"))
        donor_name = (
            row.get("NM_DOADOR_RFB")
            or row.get("NM_DOADOR")
            or "Doador não identificado"
        ).strip()
        donor_basis = donor_doc or donor_name
        donor_key = _hash_key("donor", donor_basis)
        rows.append(
            (
                row.get("SQ_CANDIDATO") or "",
                donor_key,
                donor_name,
                _parse_tse_date(row.get("DT_RECEITA")),
                _parse_amount(row.get("VR_RECEITA")),
            )
        )

        if len(rows) >= 10_000:
            con.executemany("insert into tse_receipts values (?, ?, ?, ?, ?)", rows)
            rows.clear()

    if rows:
        con.executemany("insert into tse_receipts values (?, ?, ?, ?, ?)", rows)

    return con.execute("select count(*) from tse_receipts").fetchone()[0]


def _load_receita_qsa(
    con: duckdb.DuckDBPyConnection, empresas_csv: str, socios_csv: str
) -> int:
    """Load a scoped/local Receita Empresas+Socios slice into DuckDB."""

    companies = iter_empresas_csv(empresas_csv)
    socios = iter_socios_csv(socios_csv)

    con.execute(
        """
        create or replace table receita_empresas (
          cnpj_root varchar,
          razao_social varchar
        )
        """
    )
    con.execute(
        """
        create or replace table receita_socios (
          cnpj_root varchar,
          socio_doc varchar,
          nome_socio varchar,
          tipo_socio varchar,
          qualificacao varchar,
          data_entrada varchar
        )
        """
    )

    if companies:
        con.executemany(
            "insert into receita_empresas values (?, ?)",
            [(row["cnpj_root"], row["razao_social"]) for row in companies],
        )
    if socios:
        con.executemany(
            "insert into receita_socios values (?, ?, ?, ?, ?, ?)",
            [
                (
                    row["cnpj_root"],
                    row["socio_doc"],
                    row["nome_socio"],
                    row["tipo_socio"],
                    row["qualificacao"],
                    row["data_entrada"],
                )
                for row in socios
            ],
        )
    return len(socios)


def expand_ego_network(
    con: duckdb.DuckDBPyConnection, seed: dict[str, Any], ctx: BuildContext
) -> dict[str, Any]:
    """Build one Câmara+TSE donation ego-network for a matched deputy."""

    nodes: dict[str, dict[str, Any]] = {}
    links: list[dict[str, Any]] = []

    politician_key = f"camara:{seed['camara_id']}"
    nodes[politician_key] = {
        "key": politician_key,
        "name": seed["name"],
        "category": "politician",
        "public_id": int(seed["camara_id"]),
    }

    donor_rows = con.execute(
        """
        select
          donor_key,
          any_value(donor_name) as donor_name,
          sum(amount) as total_amount,
          count(*) as receipt_count,
          min(receipt_date) as first_receipt_date,
          max(receipt_date) as last_receipt_date
        from tse_receipts
        where sq_candidate = ?
        group by donor_key
        order by total_amount desc nulls last, donor_name
        limit ?
        """,
        [seed["sq_candidate"], ctx.max_fanout],
    ).fetchall()

    for index, row in enumerate(donor_rows, start=1):
        donor_key, donor_name, total_amount, receipt_count, first_date, last_date = row
        nodes[donor_key] = {
            "key": donor_key,
            "name": donor_name or "Doador não identificado",
            "category": "donor",
        }
        first_display = _format_tse_date(first_date)
        last_display = _format_tse_date(last_date)
        if first_display and last_display:
            period = (
                first_display
                if first_display == last_display
                else f"{first_display}–{last_display}"
            )
        else:
            period = None
        description = (
            f"Doação de campanha de {_money(total_amount or 0)} em 2022 "
            f"registrada no TSE"
        )
        if receipt_count > 1:
            description += f" ({receipt_count} receitas"
            if period:
                description += f", {period}"
            description += ")"
        elif period:
            description += f" ({period})"
        links.append(
            {
                "id": index,
                "source": donor_key,
                "target": politician_key,
                "connectionType": "doacao",
                "description": description,
                "strength": 1,
            }
        )

    has_receita = (
        con.execute(
            """
            select count(*)
            from information_schema.tables
            where table_name = 'receita_socios'
            """
        ).fetchone()[0]
        > 0
    )
    if has_receita and seed.get("cpf"):
        socio_rows = con.execute(
            """
            select
              s.cnpj_root,
              coalesce(e.razao_social, concat('CNPJ raiz ', s.cnpj_root)) as company_name,
              any_value(s.tipo_socio) as tipo_socio,
              any_value(s.qualificacao) as qualificacao,
              min(s.data_entrada) as data_entrada
            from receita_socios s
            left join receita_empresas e on e.cnpj_root = s.cnpj_root
            where length(s.socio_doc) = 11
              and s.socio_doc = ?
            group by s.cnpj_root, company_name
            order by company_name
            limit ?
            """,
            [seed["cpf"], ctx.max_fanout],
        ).fetchall()

        for row in socio_rows:
            cnpj_root, company_name, _tipo_socio, qualification, entry_date = row
            company_key = f"company:{cnpj_root}"
            nodes[company_key] = {
                "key": company_key,
                "name": company_name,
                "category": "company",
            }
            description = "Participação societária registrada na base CNPJ/Receita Federal"
            if qualification:
                description += f" (qualificação {qualification})"
            if entry_date:
                description += f", entrada em {entry_date}"
            links.append(
                {
                    "id": len(links) + 1,
                    "source": politician_key,
                    "target": company_key,
                    "connectionType": "socio",
                    "description": description,
                    "strength": 1,
                }
            )

    return {"nodes": list(nodes.values()), "links": links}


def to_contract(raw_graph: dict[str, Any], seed: dict[str, Any]) -> dict[str, Any]:
    """Convert a raw graph into the public contract and scrub private keys."""

    used_ids = {int(seed["camara_id"])}
    id_by_key: dict[str, int] = {f"camara:{seed['camara_id']}": int(seed["camara_id"])}
    next_id = 1
    for node in raw_graph["nodes"]:
        key = node["key"]
        if key in id_by_key:
            continue
        while next_id in used_ids:
            next_id += 1
        id_by_key[key] = next_id
        used_ids.add(next_id)
        next_id += 1

    degree = {key: 0 for key in id_by_key}
    for link in raw_graph["links"]:
        degree[link["source"]] += 1
        degree[link["target"]] += 1

    nodes = [
        {
            "id": id_by_key[node["key"]],
            "name": node["name"],
            "category": node["category"],
            "connectionCount": degree[node["key"]],
        }
        for node in raw_graph["nodes"]
    ]
    nodes.sort(key=lambda node: (node["id"] != int(seed["camara_id"]), node["name"]))

    links = [
        {
            "id": index,
            "source": id_by_key[link["source"]],
            "target": id_by_key[link["target"]],
            "connectionType": link["connectionType"],
            "description": link["description"],
            "strength": link["strength"],
        }
        for index, link in enumerate(raw_graph["links"], start=1)
    ]

    return {
        "meta": {
            "egoId": int(seed["camara_id"]),
            "egoName": seed["name"],
            "generatedAt": datetime.now(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
            "sources": sorted(
                {
                    "camara",
                    "tse",
                    *(
                        ["receita"]
                        if any(
                            link["connectionType"] == "socio"
                            for link in raw_graph["links"]
                        )
                        else []
                    ),
                }
            ),
            "summary": None,
            "disclaimer": (
                "Dados públicos. Conexões não são acusações de irregularidade."
            ),
        },
        "nodes": nodes,
        "links": links,
    }


def _write_index(output_dir: Union[str, Path], written: list[dict[str, Any]]) -> Path:
    path = Path(output_dir) / "index.json"
    path.write_text(json.dumps(written, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def build_all(ctx: Optional[BuildContext] = None) -> int:
    """Orchestrate the Phase 2 build and return count of ego-network files."""

    ctx = ctx or BuildContext()
    con = duckdb.connect(database=":memory:")
    output_dir = Path(ctx.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    detail_pool = ctx.camara_detail_pool or max(ctx.limit * 10, 50)
    print(f"Fetching Câmara deputies (detail pool: {detail_pool})...", flush=True)
    load_seed_politicians(con, cache_dir=ctx.cache_dir, detail_limit=detail_pool)
    normalize_keys(con)
    print("Preparing TSE 2022 source files...", flush=True)
    candidates_csv, receipts_zip = prepare_2022_files(ctx.cache_dir)
    print("Loading TSE candidates...", flush=True)
    _load_tse_candidates(con, candidates_csv)

    if ctx.cnpj_empresas_csv and ctx.cnpj_socios_csv:
        print("Loading scoped Receita CNPJ/QSA CSVs...", flush=True)
        _load_receita_qsa(con, ctx.cnpj_empresas_csv, ctx.cnpj_socios_csv)
    elif ctx.cnpj_empresas_csv or ctx.cnpj_socios_csv:
        raise RuntimeError(
            "Both --cnpj-empresas-csv and --cnpj-socios-csv are required for socio edges."
        )

    matches = _matched_candidates(con)
    if not matches:
        raise RuntimeError("No Câmara deputies matched TSE 2022 candidates")

    candidate_ids = {str(seed["sq_candidate"]) for seed in matches}
    print(
        f"Streaming TSE receipts for {len(candidate_ids)} matched deputies...",
        flush=True,
    )
    _load_tse_receipts(con, receipts_zip, candidate_ids)

    selected = con.execute(
        """
        select m.*
        from (
          select
            d.camara_id,
            d.name,
            d.civil_name,
            d.cpf,
            d.party,
            d.uf,
            c.sq_candidate,
            c.ballot_name,
            c.full_name,
            c.result
          from camara_deputies d
          join tse_candidates c
            on (d.cpf is not null and d.cpf = c.cpf)
            or (
              d.cpf is null
              and d.normalized_name <> ''
              and d.normalized_name = c.normalized_name
            )
          qualify row_number() over (
            partition by d.camara_id
            order by
              case when d.cpf is not null and d.cpf = c.cpf then 0 else 1 end,
              c.result
          ) = 1
        ) m
        join (
          select sq_candidate, count(*) as receipt_count
          from tse_receipts
          group by sq_candidate
        ) r on r.sq_candidate = m.sq_candidate
        order by m.name
        limit ?
        """,
        [ctx.limit],
    ).fetchall()
    columns = [column[0] for column in con.description]
    seeds = [dict(zip(columns, row)) for row in selected]
    if not seeds:
        raise RuntimeError("No matched Câmara deputies had TSE receipt rows")
    if len(seeds) < ctx.limit:
        raise RuntimeError(
            f"Only found {len(seeds)} deputies with TSE receipts in the first "
            f"{detail_pool} Câmara rows; increase --camara-detail-pool."
        )

    index_rows: list[dict[str, Any]] = []
    for seed in seeds:
        print(f"Emitting {seed['name']}...", flush=True)
        ego_network = to_contract(expand_ego_network(con, seed, ctx), seed)
        path = emit(ego_network, output_dir)
        index_rows.append(
            {
                "id": ego_network["meta"]["egoId"],
                "name": ego_network["meta"]["egoName"],
                "party": seed.get("party"),
                "uf": seed.get("uf"),
                "sources": ego_network["meta"]["sources"],
                "path": path.name,
            }
        )

    _write_index(output_dir, index_rows)
    con.close()
    return len(index_rows)
