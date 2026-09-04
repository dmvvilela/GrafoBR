"""Import official TSE election files. CPF joins stay private; no fuzzy matching.

Independent context alongside the ego JSON: 2026 never overwrites 2022 edges.
Both an official ZIP and its extracted national CSV are accepted.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterator

from jsonschema import Draft202012Validator, FormatChecker
import httpx

ROOT = Path(__file__).resolve().parents[3]
CANDIDATES_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip"
RECEIPTS_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2026.zip"
SOURCE_URL = "https://dadosabertos.tse.jus.br/dataset/candidatos-2026"
ACCOUNTS_URL = "https://dadosabertos.tse.jus.br/dataset/prestacao-de-contas-eleitorais-2026"


def rows(path: Path, member: str, required: set[str]) -> Iterator[dict[str, str]]:
    def parse(stream):
        reader = csv.DictReader(stream, delimiter=";")
        if not required.issubset(set(reader.fieldnames or [])):
            raise ValueError(f"TSE schema changed: required columns missing in {path.name}")
        yield from reader

    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            matches = [n for n in archive.namelist() if Path(n).name.lower() == member.lower()]
            if len(matches) != 1:
                raise ValueError(f"Expected one national file {member}; do not combine national and state files")
            with archive.open(matches[0]) as raw:
                yield from parse(io.TextIOWrapper(raw, encoding="latin-1"))
    else:
        with path.open(encoding="latin-1", newline="") as stream:
            yield from parse(stream)


def cpf(value: str) -> str | None:
    # Do not pad, unmask or publish document numbers.
    normalized = re.sub(r"[.\-\s]", "", value or "")
    return normalized if re.fullmatch(r"\d{11}", normalized) and len(set(normalized)) > 1 else None


def private_profile_ids(index: list[dict], cache: Path) -> dict[str, int]:
    matches = defaultdict(set)
    for entry in index:
        if entry.get("chamber") == "senado":
            continue  # Senate API has no CPF; a shared name is not enough.
        detail = cache / "camara" / "deputados" / f"{entry['id']}.json"
        if not detail.exists():
            continue
        doc = cpf(json.loads(detail.read_text(encoding="utf-8")).get("dados", {}).get("cpf", ""))
        if doc:
            matches[doc].add(entry["id"])
    return {doc: next(iter(ids)) for doc, ids in matches.items() if len(ids) == 1}


def amount(value: str) -> Decimal:
    if not re.fullmatch(r"-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}", value or ""):
        raise ValueError("Invalid TSE receipt amount; refusing partial financial totals")
    try:
        return Decimal(value.replace(".", "").replace(",", "."))
    except InvalidOperation as exc:
        raise ValueError("Invalid TSE receipt amount") from exc


def build(candidates: Path, receipts: Path | None, index: list[dict], private_ids: dict[str, int]) -> dict:
    profiles = {e["id"]: e for e in index}
    matched = defaultdict(dict)
    source_dates = set()
    candidate_owners = {}
    row_count = 0
    required = {"ANO_ELEICAO", "SQ_CANDIDATO", "NR_CPF_CANDIDATO", "NM_CANDIDATO", "DS_CARGO", "SG_UF", "SG_PARTIDO", "NR_CANDIDATO", "DS_SITUACAO_CANDIDATURA", "DT_GERACAO", "HH_GERACAO"}
    for row in rows(candidates, "consulta_cand_2026_BRASIL.csv", required):
        if row["ANO_ELEICAO"] != "2026":
            raise ValueError("Candidate file must contain only the 2026 election")
        row_count += 1
        stamp = datetime.strptime(f"{row['DT_GERACAO']} {row['HH_GERACAO']}", "%d/%m/%Y %H:%M:%S").isoformat() + "-03:00"
        source_dates.add(stamp)
        identity = private_ids.get(cpf(row["NR_CPF_CANDIDATO"]))
        sequence = row["SQ_CANDIDATO"]
        owner = cpf(row["NR_CPF_CANDIDATO"])
        if sequence in candidate_owners and candidate_owners[sequence] != owner:
            raise ValueError("Conflicting candidate identities; resolve before publication")
        candidate_owners[sequence] = owner
        if identity is None:
            continue
        entry = {
            "politicianId": identity, "name": profiles[identity]["name"],
            "candidateName": row.get("NM_URNA_CANDIDATO") or row["NM_CANDIDATO"],
            "office": row["DS_CARGO"], "party": row["SG_PARTIDO"], "uf": row["SG_UF"],
            "ballotNumber": row["NR_CANDIDATO"], "status": row["DS_SITUACAO_CANDIDATURA"],
            "totalReceived": None, "receiptCount": None,
        }
        if sequence in matched[identity] and matched[identity][sequence] != entry:
            raise ValueError("Conflicting TSE candidate rows; resolve before publication")
        matched[identity][sequence] = entry
    if not row_count:
        raise ValueError("Empty candidate file; existing output preserved")
    # Ambiguous multiple candidacies are excluded, not guessed.
    accepted = {next(iter(values)): next(iter(values.values())) for values in matched.values() if len(values) == 1}
    finance_dates = set()
    if receipts:
        totals = defaultdict(lambda: Decimal("0"))
        counts = defaultdict(int)
        seen = {}
        finance_rows = 0
        required_receipts = {"ANO_ELEICAO", "SQ_CANDIDATO", "SQ_RECEITA", "VR_RECEITA", "DT_GERACAO", "HH_GERACAO"}
        for row in rows(receipts, "receitas_candidatos_2026_BRASIL.csv", required_receipts):
            if row["ANO_ELEICAO"] != "2026":
                raise ValueError("Receipt file must contain only the 2026 election")
            finance_rows += 1
            finance_dates.add(datetime.strptime(f"{row['DT_GERACAO']} {row['HH_GERACAO']}", "%d/%m/%Y %H:%M:%S").isoformat() + "-03:00")
            sequence = row["SQ_CANDIDATO"]
            if sequence not in accepted:
                continue
            receipt_id = row["SQ_RECEITA"]
            if not receipt_id.isdigit():
                raise ValueError("Missing receipt identity; refusing potentially duplicated totals")
            key = (sequence, receipt_id)
            value = amount(row["VR_RECEITA"])
            if key in seen:
                if seen[key] != value:
                    raise ValueError("Conflicting receipt revisions; resolve before publication")
                continue
            seen[key] = value
            totals[sequence] += value
            counts[sequence] += 1
        if not finance_rows:
            raise ValueError("Empty receipt file; existing output preserved")
        for sequence, entry in accepted.items():
            if counts[sequence]:
                entry.update(totalReceived=float(totals[sequence]), receiptCount=counts[sequence])
    return {
        "year": 2026, "importedAt": datetime.now(timezone.utc).isoformat(),
        "sourceGeneratedAt": max(source_dates), "sourceUrl": SOURCE_URL,
        "financeSourceUrl": ACCOUNTS_URL,
        "financeGeneratedAt": max(finance_dates) if finance_dates else None,
        "financeImported": receipts is not None,
        "scopeProfiles": len(index), "matchedProfiles": len(accepted),
        "ambiguousProfiles": sum(len(v) > 1 for v in matched.values()),
        "entries": sorted(accepted.values(), key=lambda e: e["politicianId"]),
        "note": "Pareamento exato por identificador, mantido privado. Ausência de pareamento não significa ausência de candidatura. Receitas parciais declaradas ao TSE; não são contas finais nem julgamento de regularidade. Senadores sem identificador compatível não são pareados automaticamente.",
    }


def download(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp = destination.with_suffix(".tmp")
    try:
        with httpx.stream("GET", url, timeout=120, follow_redirects=True) as response:
            response.raise_for_status()
            with temp.open("wb") as target:
                for chunk in response.iter_bytes():
                    target.write(chunk)
        if not zipfile.is_zipfile(temp):
            raise ValueError("TSE did not return a ZIP; previous download preserved")
        temp.replace(destination)
    finally:
        temp.unlink(missing_ok=True)
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--candidates", type=Path, help="Official 2026 national CSV or ZIP")
    parser.add_argument("--receipts", type=Path, help="Optional official 2026 receipts CSV or ZIP")
    parser.add_argument("--download", action="store_true", help="Fetch candidates anew from TSE")
    parser.add_argument("--download-receipts", action="store_true", help="Also fetch partial campaign receipts")
    parser.add_argument("--index", type=Path, default=ROOT / "web/public/data/index.json")
    parser.add_argument("--cache", type=Path, default=ROOT / "pipeline/.cache")
    parser.add_argument("--output", type=Path, default=ROOT / "data/_elections-2026.json")
    args = parser.parse_args()
    if args.download:
        args.candidates = download(CANDIDATES_URL, args.cache / "elections/consulta_cand_2026.zip")
    if args.download_receipts:
        args.receipts = download(RECEIPTS_URL, args.cache / "elections/prestacao_de_contas_eleitorais_candidatos_2026.zip")
    if not args.candidates:
        parser.error("provide --candidates or --download")
    index = json.loads(args.index.read_text(encoding="utf-8"))
    payload = build(args.candidates, args.receipts, index, private_profile_ids(index, args.cache))
    schema = json.loads((ROOT / "contract/elections.schema.json").read_text())
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(payload)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix(".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(args.output)
    print(f"Imported 2026: {payload['matchedProfiles']} matched profiles; {payload['ambiguousProfiles']} ambiguous; no private identifiers published")


if __name__ == "__main__":
    main()
