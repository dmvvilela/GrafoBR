"""Câmara dos Deputados source helpers.

Phase 2 uses the public Dados Abertos REST API to seed the build with sitting
federal deputies. The Câmara numeric id is public and stable enough to name the
generated ego-network file; CPF is kept only inside the build for joins.
"""

from __future__ import annotations

import csv
import json
import re
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Optional

import httpx

CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2"
CEAP_CSV_ZIP_URL = "https://www.camara.leg.br/cotas/Ano-{year}.csv.zip"


@dataclass(frozen=True)
class Deputy:
    camara_id: int
    name: str
    civil_name: Optional[str]
    cpf: Optional[str]
    party: Optional[str]
    uf: Optional[str]
    email: Optional[str]
    birth_date: Optional[str] = None


def _digits(value: Optional[str], width: Optional[int] = None) -> Optional[str]:
    if not value:
        return None
    digits = "".join(char for char in value if char.isdigit())
    if not digits:
        return None
    return digits.zfill(width) if width else digits


def _get_json(
    client: httpx.Client,
    url: str,
    params: Optional[dict[str, Any]] = None,
    *,
    attempts: int = 4,
) -> Any:
    last_error: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        try:
            response = client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, httpx.TimeoutException) as error:
            last_error = error
            if attempt == attempts:
                break
            time.sleep(0.5 * 2 ** (attempt - 1))
    raise RuntimeError(
        f"failed to fetch Câmara API URL after {attempts} attempts: {url}"
    ) from last_error


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    temp_path.replace(path)


def _download_file(
    client: httpx.Client,
    url: str,
    output_path: Path,
    *,
    attempts: int = 4,
) -> Path:
    if output_path.exists() and output_path.stat().st_size > 0:
        return output_path

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_suffix(output_path.suffix + ".tmp")
    last_error: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        try:
            with client.stream("GET", url) as response:
                response.raise_for_status()
                with temp_path.open("wb") as handle:
                    for chunk in response.iter_bytes():
                        handle.write(chunk)
            temp_path.replace(output_path)
            return output_path
        except (httpx.HTTPError, httpx.TimeoutException) as error:
            last_error = error
            temp_path.unlink(missing_ok=True)
            if attempt == attempts:
                break
            time.sleep(0.5 * 2 ** (attempt - 1))

    raise RuntimeError(
        f"failed to download Câmara file after {attempts} attempts: {url}"
    ) from last_error


def _cached_json(
    client: httpx.Client,
    cache_path: Path,
    url: str,
    params: Optional[dict[str, Any]] = None,
) -> Any:
    if cache_path.exists() and cache_path.stat().st_size > 0:
        return _read_json(cache_path)
    payload = _get_json(client, url, params=params)
    _write_json(cache_path, payload)
    return payload


def fetch_current_deputies(
    cache_dir: str | Path = ".cache",
    *,
    detail_limit: Optional[int] = None,
) -> list[Deputy]:
    """Fetch current deputies plus detail rows from Câmara Dados Abertos."""

    cache = Path(cache_dir) / "camara"
    details_cache = cache / "deputados"

    with httpx.Client(timeout=30, follow_redirects=True) as client:
        rows: list[dict[str, Any]] = []
        page = 1
        while True:
            payload = _cached_json(
                client,
                cache / f"deputados-page-{page}.json",
                f"{CAMARA_API}/deputados",
                params={
                    "itens": 100,
                    "pagina": page,
                    "ordem": "ASC",
                    "ordenarPor": "nome",
                },
            )
            page_rows = payload.get("dados", [])
            rows.extend(page_rows)
            if not any(link.get("rel") == "next" for link in payload.get("links", [])):
                break
            page += 1

        if detail_limit is not None:
            rows = rows[:detail_limit]

        deputies: list[Deputy] = []
        for row in rows:
            detail_payload = _cached_json(
                client,
                details_cache / f"{row['id']}.json",
                f"{CAMARA_API}/deputados/{row['id']}",
            )
            detail = detail_payload.get("dados", {})
            status = detail.get("ultimoStatus") or {}
            deputies.append(
                Deputy(
                    camara_id=int(row["id"]),
                    name=status.get("nome") or row.get("nome") or detail.get("nomeCivil"),
                    civil_name=detail.get("nomeCivil"),
                    cpf=_digits(detail.get("cpf"), 11),
                    party=status.get("siglaPartido") or row.get("siglaPartido"),
                    uf=status.get("siglaUf") or row.get("siglaUf"),
                    email=status.get("email") or row.get("email"),
                    birth_date=detail.get("dataNascimento"),
                )
            )

    return deputies


def prepare_ceap_file(cache_dir: str | Path = ".cache", *, year: int) -> Path:
    """Download Câmara's yearly CEAP CSV zip into the local cache."""

    cache = Path(cache_dir) / "camara" / "ceap"
    output_path = cache / f"Ano-{year}.csv.zip"
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        return _download_file(
            client,
            CEAP_CSV_ZIP_URL.format(year=year),
            output_path,
        )


def _open_ceap_rows(path: str | Path) -> Iterable[dict[str, str]]:
    source = Path(path)
    if source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as archive:
            members = [
                name for name in archive.namelist() if name.lower().endswith(".csv")
            ]
            if not members:
                return
            with archive.open(members[0]) as handle:
                text = (line.decode("utf-8-sig") for line in handle)
                yield from csv.DictReader(text, delimiter=";")
    else:
        with source.open("r", encoding="utf-8-sig", newline="") as handle:
            yield from csv.DictReader(handle, delimiter=";")


def parse_ceap_amount(value: Optional[str]) -> float:
    if not value:
        return 0.0
    cleaned = value.strip()
    if "," in cleaned:
        normalized = cleaned.replace(".", "").replace(",", ".")
    else:
        normalized = cleaned
    try:
        return float(normalized)
    except ValueError:
        return 0.0


def _public_supplier_name(value: str) -> str:
    cleaned = re.sub(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b", "", value)
    cleaned = re.sub(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", "", cleaned)
    cleaned = re.sub(r"\d{11,14}", "", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip(" -/.,")


def iter_ceap_expenses(path: str | Path) -> Iterable[dict[str, Any]]:
    """Yield normalized CEAP expense rows from a yearly Câmara CSV/zip.

    Source columns are public, but CPF/CNPJ values remain build-internal and are
    used only to derive stable opaque supplier nodes.
    """

    for row in _open_ceap_rows(path):
        deputy_id = _digits(row.get("ideCadastro"))
        supplier_raw_name = (row.get("txtFornecedor") or "").strip()
        supplier_name = _public_supplier_name(supplier_raw_name)
        if not deputy_id or not supplier_raw_name:
            continue
        amount = parse_ceap_amount(row.get("vlrLiquido"))
        if amount <= 0:
            continue
        yield {
            "deputy_id": int(deputy_id),
            "supplier_name": supplier_name or "Fornecedor não identificado",
            "supplier_doc": _digits(row.get("txtCNPJCPF")),
            "description": (row.get("txtDescricao") or "").strip(),
            "issue_date": (row.get("datEmissao") or "").strip()[:10],
            "year": int(row.get("numAno") or 0),
            "month": int(row.get("numMes") or 0),
            "amount": amount,
        }
