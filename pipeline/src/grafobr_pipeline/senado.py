"""Senado Dados Abertos — current senators as ego-network seeds.

The Senate's open data exposes name, party, UF and photo but NOT CPF, so the
masked-CPF sócio/contrato match is impossible for senators (documented in the
UI). What we can attribute is emendas individuais (matched by author name) — the
dominant money trail, where senators direct comparable sums to deputies.

Senator node ids are offset by SENATOR_ID_OFFSET so they never collide with
Câmara ids (which are < ~230k); the offset also lets the frontend derive the
Senate photo URL from the id alone.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx

SENADO_API = "https://legis.senado.leg.br/dadosabertos"
SENATOR_ID_OFFSET = 900_000


@dataclass(frozen=True)
class Senator:
    code: int
    name: str
    full_name: Optional[str]
    party: Optional[str]
    uf: Optional[str]
    photo_url: Optional[str]

    @property
    def ego_id(self) -> int:
        return SENATOR_ID_OFFSET + self.code


def fetch_current_senators(cache_dir: str | Path = ".cache") -> list[Senator]:
    cache = Path(cache_dir) / "senado"
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / "senadores_atual.json"

    if path.exists() and path.stat().st_size > 0:
        data = json.loads(path.read_text(encoding="utf-8"))
    else:
        headers = {"Accept": "application/json", "User-Agent": "GrafoBR/1.0"}
        with httpx.Client(timeout=30, headers=headers, follow_redirects=True) as client:
            last: Optional[Exception] = None
            for attempt in range(1, 5):
                try:
                    resp = client.get(f"{SENADO_API}/senador/lista/atual")
                    resp.raise_for_status()
                    data = resp.json()
                    break
                except httpx.HTTPError as error:
                    last = error
                    if attempt == 4:
                        raise RuntimeError("failed to fetch Senado list") from last
                    time.sleep(0.5 * 2 ** (attempt - 1))
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    parls = data["ListaParlamentarEmExercicio"]["Parlamentares"]["Parlamentar"]
    senators: list[Senator] = []
    for p in parls:
        ident = p["IdentificacaoParlamentar"]
        photo = (ident.get("UrlFotoParlamentar") or "").replace("http://", "https://")
        senators.append(
            Senator(
                code=int(ident["CodigoParlamentar"]),
                name=ident.get("NomeParlamentar"),
                full_name=ident.get("NomeCompletoParlamentar"),
                party=ident.get("SiglaPartidoParlamentar"),
                uf=ident.get("UfParlamentar"),
                photo_url=photo or None,
            )
        )
    return senators
