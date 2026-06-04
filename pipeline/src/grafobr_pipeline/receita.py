"""Receita Federal CNPJ source helpers.

This module intentionally stops at source discovery for now. Full CNPJ/QSA
ingestion is the next heavy step, and it must stay scoped to the politician
neighborhood instead of loading the whole national company registry.
"""

from __future__ import annotations

import argparse
import csv
import io
import zipfile
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Sequence, TextIO

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


@dataclass(frozen=True)
class ScopedQsaPaths:
    empresas_csv: Path
    socios_csv: Path
    matched_socios: int
    matched_companies: int


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


def _detect_delimiter(first_line: str) -> str:
    return ";" if first_line.count(";") > first_line.count(",") else ","


def _open_text_members(path: Path) -> Iterator[TextIO]:
    if path.is_dir():
        for child in sorted(path.iterdir()):
            yield from _open_text_members(child)
        return

    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            for member in archive.namelist():
                if member.endswith("/"):
                    continue
                with archive.open(member) as raw:
                    yield io.TextIOWrapper(raw, encoding="latin-1", newline="")
        return

    with path.open("r", encoding="latin-1", newline="") as handle:
        yield handle


def _iter_receita_records(inputs: Iterable[str | Path]) -> Iterator[list[str] | dict[str, str]]:
    for source in inputs:
        for handle in _open_text_members(Path(source)):
            first = handle.readline()
            if not first:
                continue
            delimiter = _detect_delimiter(first)
            handle.seek(0)
            if any(token in first.lower() for token in ("cnpj", "razao", "socio", "cpf")):
                yield from csv.DictReader(handle, delimiter=delimiter)
            else:
                yield from csv.reader(handle, delimiter=delimiter)


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


def _empresa_from_record(record: list[str] | dict[str, str]) -> Optional[dict[str, str]]:
    if isinstance(record, dict):
        root = company_root(record.get("cnpj") or record.get("cnpj_basico"))
        name = record.get("razao_social") or record.get("nome_empresarial")
    else:
        if len(record) < 2:
            return None
        root = company_root(record[0])
        name = record[1]
    if not root or not name:
        return None
    return {"cnpj_root": root, "razao_social": name.strip().upper()}


def _socio_from_record(record: list[str] | dict[str, str]) -> Optional[dict[str, str]]:
    if isinstance(record, dict):
        root = company_root(record.get("cnpj") or record.get("cnpj_basico"))
        doc = digits(record.get("cpf_socio") or record.get("cpf_cnpj_socio"))
        name = record.get("nome_socio")
        partner_type = record.get("tipo_socio") or record.get("identificador_socio")
        qualification = record.get("qualificacao_socio") or record.get("qualificacao")
        entry_date = record.get("data_entrada") or record.get("data_entrada_sociedade")
    else:
        if len(record) < 5:
            return None
        root = company_root(record[0])
        partner_type = record[1]
        name = record[2]
        doc = digits(record[3])
        qualification = record[4]
        entry_date = record[5] if len(record) > 5 else None
    if not root or not doc or not name:
        return None
    return {
        "cnpj_root": root,
        "socio_doc": doc,
        "nome_socio": name.strip().upper(),
        "tipo_socio": partner_type or "",
        "qualificacao": qualification or "",
        "data_entrada": entry_date or "",
    }


def slice_qsa_sources(
    *,
    empresas_inputs: Sequence[str | Path],
    socios_inputs: Sequence[str | Path],
    target_cpfs: Iterable[str],
    output_dir: str | Path,
) -> ScopedQsaPaths:
    """Write scoped Empresas/Socios CSVs matching the target CPF neighborhood.

    Real Receita Socios files mask CPF as the middle six digits. This slicer
    keeps rows whose partner document is either a target full CPF or a target
    middle-six CPF. Name disambiguation happens later during graph expansion.
    """

    full_cpfs = {value for value in (digits(cpf, 11) for cpf in target_cpfs) if value}
    middle_six = {cpf[3:9] for cpf in full_cpfs}

    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    socios_path = output / "receita_socios_scoped.csv"
    empresas_path = output / "receita_empresas_scoped.csv"

    company_roots: set[str] = set()
    matched_socios = 0
    with socios_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "cnpj",
                "nome_socio",
                "cpf_socio",
                "tipo_socio",
                "qualificacao",
                "data_entrada",
            ],
        )
        writer.writeheader()
        for record in _iter_receita_records(socios_inputs):
            socio = _socio_from_record(record)
            if not socio:
                continue
            doc = socio["socio_doc"]
            if not (doc in full_cpfs or (len(doc) == 6 and doc in middle_six)):
                continue
            company_roots.add(socio["cnpj_root"])
            matched_socios += 1
            writer.writerow(
                {
                    "cnpj": socio["cnpj_root"],
                    "nome_socio": socio["nome_socio"],
                    "cpf_socio": socio["socio_doc"],
                    "tipo_socio": socio["tipo_socio"],
                    "qualificacao": socio["qualificacao"],
                    "data_entrada": socio["data_entrada"],
                }
            )

    matched_companies = 0
    with empresas_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["cnpj", "razao_social"])
        writer.writeheader()
        seen_roots: set[str] = set()
        for record in _iter_receita_records(empresas_inputs):
            company = _empresa_from_record(record)
            if not company:
                continue
            root = company["cnpj_root"]
            if root not in company_roots or root in seen_roots:
                continue
            seen_roots.add(root)
            matched_companies += 1
            writer.writerow({"cnpj": root, "razao_social": company["razao_social"]})

    return ScopedQsaPaths(
        empresas_csv=empresas_path,
        socios_csv=socios_path,
        matched_socios=matched_socios,
        matched_companies=matched_companies,
    )


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
    parser = argparse.ArgumentParser(description="Receita Federal CNPJ helpers")
    parser.add_argument("--release", help="specific YYYY-MM release to probe")
    subparsers = parser.add_subparsers(dest="command")

    probe = subparsers.add_parser("probe", help="probe the current CNPJ release")
    probe.add_argument("--release", help="specific YYYY-MM release to probe")

    slicer = subparsers.add_parser("slice-qsa", help="write scoped Empresas/Socios CSVs")
    slicer.add_argument("--empresas-input", action="append", required=True)
    slicer.add_argument("--socios-input", action="append", required=True)
    slicer.add_argument("--target-cpf", action="append", default=[])
    slicer.add_argument("--target-cpf-file")
    slicer.add_argument("--output-dir", required=True)

    args = parser.parse_args()

    if args.command in {None, "probe"}:
        release = resolve_cnpj_release(year_month=getattr(args, "release", None))
        print(f"{release.mode}: {release.base_url}")
        print(f"checked: {release.checked_url}")
        return 0

    target_cpfs = list(args.target_cpf)
    if args.target_cpf_file:
        target_cpfs.extend(
            line.strip()
            for line in Path(args.target_cpf_file).read_text(encoding="utf-8").splitlines()
            if line.strip()
        )
    if not target_cpfs:
        raise SystemExit("slice-qsa requires --target-cpf or --target-cpf-file")

    paths = slice_qsa_sources(
        empresas_inputs=args.empresas_input,
        socios_inputs=args.socios_input,
        target_cpfs=target_cpfs,
        output_dir=args.output_dir,
    )
    print(f"empresas: {paths.empresas_csv} ({paths.matched_companies})")
    print(f"socios: {paths.socios_csv} ({paths.matched_socios})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
