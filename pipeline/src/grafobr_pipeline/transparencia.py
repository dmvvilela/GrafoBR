"""Portal da Transparencia source helpers.

The v1 pipeline only uses a scoped/local contracts CSV. It links public
contract totals to companies already present in an ego-network and does not
infer amendment steering.
"""

from __future__ import annotations

import csv
import re
import unicodedata
from pathlib import Path
from typing import Optional

from .receita import company_root, digits

_SIGILOSO_CNPJ = "-11"
_MAX_REASONABLE_CONTRACT_VALUE = 10_000_000_000


def _compact_key(value: str) -> str:
    text = unicodedata.normalize("NFKD", value)
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def _pick(row: dict[str, str], *names: str) -> Optional[str]:
    by_key = {_compact_key(key): value for key, value in row.items()}
    for name in names:
        value = by_key.get(_compact_key(name))
        if value not in {None, ""}:
            return value
    return None


def parse_brl(value: Optional[str]) -> Optional[float]:
    if not value:
        return 0.0
    cleaned = re.sub(r"[R$\s]", "", str(value).strip())
    if not cleaned:
        return 0.0
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        parsed = float(cleaned)
    except ValueError:
        return 0.0
    if parsed > _MAX_REASONABLE_CONTRACT_VALUE:
        return None
    return parsed


def _normalize_label(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", str(value).strip()).upper()


def iter_contracts_csv(path: str | Path) -> list[dict[str, Optional[str] | float]]:
    """Read Portal da Transparencia contracts into normalized rows."""

    rows: list[dict[str, Optional[str] | float]] = []
    with Path(path).open("r", encoding="utf-8-sig", newline="") as handle:
        sample = handle.readline()
        delimiter = ";" if sample.count(";") > sample.count(",") else ","
        handle.seek(0)
        reader = csv.DictReader(handle, delimiter=delimiter)
        for row in reader:
            raw_cnpj = (_pick(row, "cnpj_contratada", "cnpj", "cpf_cnpj") or "").strip()
            if raw_cnpj == _SIGILOSO_CNPJ:
                continue
            cnpj_digits = digits(raw_cnpj)
            if not cnpj_digits or len(cnpj_digits) != 14:
                continue
            root = company_root(cnpj_digits)
            if not root:
                continue
            rows.append(
                {
                    "cnpj_root": root,
                    "razao_social": _normalize_label(
                        _pick(row, "razao_social", "nome_fornecedor", "fornecedor")
                    ),
                    "object": _normalize_label(_pick(row, "objeto", "descricao")),
                    "value": parse_brl(_pick(row, "valor", "valor_contrato")),
                    "contracting_org": _normalize_label(
                        _pick(row, "orgao_contratante", "orgao", "unidade_gestora")
                    ),
                    "date": _pick(row, "data_inicio", "data_assinatura", "data"),
                }
            )
    return rows
