"""Receita Federal CNPJ source helpers.

This module intentionally stops at source discovery for now. Full CNPJ/QSA
ingestion is the next heavy step, and it must stay scoped to the politician
neighborhood instead of loading the whole national company registry.
"""

from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Sequence

import httpx

ARCHIVE_BASE_PATTERN = (
    "https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/{year_month}/"
)
NEXTCLOUD_DOWNLOAD_PATTERN = (
    "https://arquivos.receitafederal.gov.br/s/{token}/download?path=%2F&files="
)
LEGACY_BASE_URL = "https://dadosabertos.rfb.gov.br/CNPJ/"
LEGACY_MONTHLY_BASE_PATTERN = (
    "https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj/{year_month}/"
)

# Public tokens observed in the current reference registry/scripts. Tokens are
# probes, not credentials; callers may override with CNPJ_SHARE_TOKEN later.
KNOWN_NEXTCLOUD_TOKENS = ("gn672Ad4CF8N6TK", "YggdBLfdninEJX9")

CNPJ_FILE_TYPES = ("Empresas", "Socios", "Estabelecimentos")
REFERENCE_FILES = (
    "Naturezas.zip",
    "Qualificacoes.zip",
    "Cnaes.zip",
    "Municipios.zip",
    "Paises.zip",
    "Motivos.zip",
)


@dataclass(frozen=True)
class CnpjRelease:
    base_url: str
    mode: str
    checked_url: str


def _month_candidates(now: Optional[datetime] = None, months: int = 4) -> list[str]:
    cursor = (now or datetime.now(timezone.utc)).replace(day=1)
    candidates: list[str] = []
    for _ in range(months):
        candidates.append(f"{cursor.year:04d}-{cursor.month:02d}")
        if cursor.month == 1:
            cursor = cursor.replace(year=cursor.year - 1, month=12)
        else:
            cursor = cursor.replace(month=cursor.month - 1)
    return candidates


def _head_ok(
    client: httpx.Client,
    url: str,
    *,
    follow_redirects: bool = True,
    accept_redirect: bool = False,
) -> bool:
    try:
        response = client.head(url, follow_redirects=follow_redirects)
    except httpx.HTTPError:
        return False
    if response.status_code < 400:
        return True
    return accept_redirect and response.status_code in {301, 302, 303, 307, 308}


def cnpj_zip_names(file_types: Sequence[str] = CNPJ_FILE_TYPES) -> list[str]:
    """Return Receita's numbered main CNPJ zip names for the requested types."""

    return [f"{file_type}{index}.zip" for file_type in file_types for index in range(10)]


def digits(value: Optional[str], width: Optional[int] = None) -> Optional[str]:
    if not value:
        return None
    parsed = "".join(char for char in str(value) if char.isdigit())
    if not parsed:
        return None
    return parsed.zfill(width) if width else parsed


def company_root(value: Optional[str]) -> Optional[str]:
    parsed = digits(value)
    if not parsed:
        return None
    if len(parsed) >= 14:
        return parsed[:8]
    return parsed.zfill(8)


def _has_header(path: Path) -> bool:
    with path.open("r", encoding="latin-1", errors="ignore") as handle:
        first = handle.readline()
    lowered = first.lower()
    return any(token in lowered for token in ("cnpj", "razao", "socio", "cpf"))


def iter_empresas_csv(path: str | Path) -> list[dict[str, Optional[str]]]:
    """Read a Receita Empresas CSV or a headered fixture into normalized rows."""

    file_path = Path(path)
    rows: list[dict[str, Optional[str]]] = []
    with file_path.open("r", encoding="latin-1", newline="") as handle:
        if _has_header(file_path):
            reader = csv.DictReader(handle)
            delimiter = ";" if reader.fieldnames and len(reader.fieldnames) == 1 else ","
            handle.seek(0)
            reader = csv.DictReader(handle, delimiter=delimiter)
            for row in reader:
                root = company_root(row.get("cnpj") or row.get("cnpj_basico"))
                name = row.get("razao_social") or row.get("nome_empresarial")
                if root and name:
                    rows.append({"cnpj_root": root, "razao_social": name.strip().upper()})
        else:
            reader = csv.reader(handle, delimiter=";")
            for row in reader:
                if len(row) < 2:
                    continue
                root = company_root(row[0])
                if root and row[1]:
                    rows.append({"cnpj_root": root, "razao_social": row[1].strip().upper()})
    return rows


def iter_socios_csv(path: str | Path) -> list[dict[str, Optional[str]]]:
    """Read a Receita Socios CSV or a headered fixture into normalized rows."""

    file_path = Path(path)
    rows: list[dict[str, Optional[str]]] = []
    with file_path.open("r", encoding="latin-1", newline="") as handle:
        if _has_header(file_path):
            reader = csv.DictReader(handle)
            delimiter = ";" if reader.fieldnames and len(reader.fieldnames) == 1 else ","
            handle.seek(0)
            reader = csv.DictReader(handle, delimiter=delimiter)
            for row in reader:
                root = company_root(row.get("cnpj") or row.get("cnpj_basico"))
                doc = digits(row.get("cpf_socio") or row.get("cpf_cnpj_socio"))
                name = row.get("nome_socio")
                partner_type = row.get("tipo_socio") or row.get("identificador_socio")
                qualification = row.get("qualificacao_socio") or row.get("qualificacao")
                entry_date = row.get("data_entrada") or row.get("data_entrada_sociedade")
                if root and doc and name:
                    rows.append(
                        {
                            "cnpj_root": root,
                            "socio_doc": doc,
                            "nome_socio": name.strip().upper(),
                            "tipo_socio": partner_type,
                            "qualificacao": qualification,
                            "data_entrada": entry_date,
                        }
                    )
        else:
            reader = csv.reader(handle, delimiter=";")
            for row in reader:
                if len(row) < 5:
                    continue
                root = company_root(row[0])
                doc = digits(row[3])
                if root and doc and row[2]:
                    rows.append(
                        {
                            "cnpj_root": root,
                            "socio_doc": doc,
                            "nome_socio": row[2].strip().upper(),
                            "tipo_socio": row[1],
                            "qualificacao": row[4],
                            "data_entrada": row[5] if len(row) > 5 else None,
                        }
                    )
    return rows


def resolve_cnpj_release(
    *,
    year_month: Optional[str] = None,
    nextcloud_tokens: Sequence[str] = KNOWN_NEXTCLOUD_TOKENS,
    timeout: float = 5,
) -> CnpjRelease:
    """Resolve an accessible CNPJ release base URL without downloading archives."""

    months = [year_month] if year_month else _month_candidates()
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        for month in months:
            base_url = ARCHIVE_BASE_PATTERN.format(year_month=month)
            checked_url = f"{base_url}Empresas0.zip"
            if _head_ok(client, checked_url):
                return CnpjRelease(
                    base_url=base_url,
                    mode="archive-monthly",
                    checked_url=checked_url,
                )

        for token in nextcloud_tokens:
            base_url = NEXTCLOUD_DOWNLOAD_PATTERN.format(token=token)
            checked_url = f"{base_url}Empresas0.zip"
            if _head_ok(
                client,
                checked_url,
                follow_redirects=False,
                accept_redirect=True,
            ):
                return CnpjRelease(
                    base_url=base_url,
                    mode="nextcloud-share",
                    checked_url=checked_url,
                )

        for month in months:
            base_url = LEGACY_MONTHLY_BASE_PATTERN.format(year_month=month)
            checked_url = f"{base_url}Empresas0.zip"
            if _head_ok(client, checked_url):
                return CnpjRelease(
                    base_url=base_url,
                    mode="legacy-monthly",
                    checked_url=checked_url,
                )

        checked_url = f"{LEGACY_BASE_URL}Empresas0.zip"
        if _head_ok(client, checked_url):
            return CnpjRelease(
                base_url=LEGACY_BASE_URL,
                mode="legacy-flat",
                checked_url=checked_url,
            )

    tried = ", ".join(months)
    raise RuntimeError(
        "Could not resolve Receita CNPJ release. "
        f"Tried monthly archive/legacy months [{tried}], Nextcloud shares, "
        "and the legacy flat URL."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe Receita Federal CNPJ release")
    parser.add_argument("--release", help="specific YYYY-MM release to probe")
    args = parser.parse_args()

    release = resolve_cnpj_release(year_month=args.release)
    print(f"{release.mode}: {release.base_url}")
    print(f"checked: {release.checked_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
