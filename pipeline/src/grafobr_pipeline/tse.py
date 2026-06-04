"""TSE source helpers for 2022 candidates and campaign receipts."""

from __future__ import annotations

import zipfile
import csv
from pathlib import Path
from collections.abc import Iterator
from typing import Union

import httpx

TSE_CANDIDATES_2022_URL = (
    "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/"
    "consulta_cand_2022.zip"
)
TSE_RECEIPTS_2022_URL = (
    "https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/"
    "prestacao_de_contas_eleitorais_candidatos_2022.zip"
)


def _download(url: str, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.stat().st_size > 0:
        return path

    temp_path = path.with_suffix(path.suffix + ".tmp")
    with httpx.stream("GET", url, timeout=120, follow_redirects=True) as response:
        response.raise_for_status()
        with temp_path.open("wb") as handle:
            for chunk in response.iter_bytes():
                handle.write(chunk)
    temp_path.replace(path)
    return path


def _find_member(zip_path: Path, filename: str) -> str:
    with zipfile.ZipFile(zip_path) as archive:
        matches = [
            member
            for member in archive.namelist()
            if Path(member).name.lower() == filename.lower()
        ]
    if not matches:
        raise FileNotFoundError(f"{filename} not found in {zip_path}")
    return matches[0]


def _extract_member(zip_path: Path, output_dir: Path, filename: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / filename
    if output_path.exists() and output_path.stat().st_size > 0:
        return output_path

    member = _find_member(zip_path, filename)
    with zipfile.ZipFile(zip_path) as archive:
        with archive.open(member) as source, output_path.open("wb") as target:
            target.write(source.read())
    return output_path


def prepare_2022_files(cache_dir: Union[str, Path]) -> tuple[Path, Path]:
    """Download source zips and extract the small national candidate CSV.

    The receipts zip is intentionally not extracted here. The national CSV is large,
    so Phase 2 streams only rows for the candidate ids we are emitting.
    """

    cache = Path(cache_dir)
    zip_dir = cache / "downloads"
    csv_dir = cache / "tse-2022"

    candidates_zip = _download(TSE_CANDIDATES_2022_URL, zip_dir / "consulta_cand_2022.zip")
    receipts_zip = _download(
        TSE_RECEIPTS_2022_URL,
        zip_dir / "prestacao_de_contas_eleitorais_candidatos_2022.zip",
    )

    candidates_csv = _extract_member(
        candidates_zip, csv_dir, "consulta_cand_2022_BRASIL.csv"
    )
    return candidates_csv, receipts_zip


def iter_receipts_for_candidates(
    receipts_zip: Union[str, Path], candidate_ids: set[str]
) -> Iterator[dict[str, str]]:
    """Yield TSE receipt rows for the provided ``SQ_CANDIDATO`` values."""

    member = _find_member(Path(receipts_zip), "receitas_candidatos_2022_BRASIL.csv")
    with zipfile.ZipFile(receipts_zip) as archive:
        with archive.open(member) as raw:
            text = (line.decode("latin-1") for line in raw)
            reader = csv.DictReader(text, delimiter=";")
            for row in reader:
                if row.get("SQ_CANDIDATO") in candidate_ids:
                    yield row
