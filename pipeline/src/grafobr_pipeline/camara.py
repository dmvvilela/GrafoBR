"""Câmara dos Deputados source helpers.

Phase 2 uses the public Dados Abertos REST API to seed the build with sitting
federal deputies. The Câmara numeric id is public and stable enough to name the
generated ego-network file; CPF is kept only inside the build for joins.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import httpx

CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2"


@dataclass(frozen=True)
class Deputy:
    camara_id: int
    name: str
    civil_name: Optional[str]
    cpf: Optional[str]
    party: Optional[str]
    uf: Optional[str]
    email: Optional[str]


def _digits(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    digits = "".join(char for char in value if char.isdigit())
    return digits.zfill(11) if digits else None


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
                    cpf=_digits(detail.get("cpf")),
                    party=status.get("siglaPartido") or row.get("siglaPartido"),
                    uf=status.get("siglaUf") or row.get("siglaUf"),
                    email=status.get("email") or row.get("email"),
                )
            )

    return deputies
