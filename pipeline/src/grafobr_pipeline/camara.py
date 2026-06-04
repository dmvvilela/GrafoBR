"""Câmara dos Deputados source helpers.

Phase 2 uses the public Dados Abertos REST API to seed the build with sitting
federal deputies. The Câmara numeric id is public and stable enough to name the
generated ego-network file; CPF is kept only inside the build for joins.
"""

from __future__ import annotations

from dataclasses import dataclass
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
    client: httpx.Client, url: str, params: Optional[dict[str, Any]] = None
) -> Any:
    response = client.get(url, params=params)
    response.raise_for_status()
    return response.json()


def fetch_current_deputies() -> list[Deputy]:
    """Fetch current deputies plus detail rows from Câmara Dados Abertos."""

    with httpx.Client(timeout=30, follow_redirects=True) as client:
        rows: list[dict[str, Any]] = []
        page = 1
        while True:
            payload = _get_json(
                client,
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

        deputies: list[Deputy] = []
        for row in rows:
            detail = _get_json(client, f"{CAMARA_API}/deputados/{row['id']}").get(
                "dados", {}
            )
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
