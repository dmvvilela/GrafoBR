"""Reviewed executive roster + exact historical TSE identity matching.

The roster establishes office, never election results. A candidate's receipts belong
only to that candidate, never automatically to their running mate or successor.
Public IDs are permanent person IDs; do not reuse them when a seat changes hands.
"""
from __future__ import annotations

import csv
import json
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse

from .elections import cpf

ROSTER = Path(__file__).resolve().parents[2] / "config/executives.json"
UFS = set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split())


def load_roster(path: Path = ROSTER, *, today: date | None = None) -> list[dict]:
    entries = json.loads(path.read_text(encoding="utf-8"))
    ids = [e["id"] for e in entries]
    if len(set(ids)) != len(ids) or any(i < 1_000_000 for i in ids):
        raise ValueError("Executive person IDs must be unique and reserved")
    if len(entries) != 28 or {e['uf'] for e in entries} != UFS | {'BR'}:
        raise ValueError("Executive roster must cover the presidency and all 27 UFs exactly once")
    for e in entries:
        if e['chamber'] != ('presidencia' if e['uf'] == 'BR' else 'governo'):
            raise ValueError("Office and jurisdiction disagree")
        host = urlparse(e['sourceUrl']).hostname or ''
        if not host.endswith(('.gov.br', '.leg.br')):
            raise ValueError("Officeholder evidence must be an official government or legislature source")
        age = ((today or date.today()) - date.fromisoformat(e['verifiedAt'])).days
        if age < 0 or age > 45:
            raise ValueError("Review the executive officeholder roster before rebuilding (45-day limit)")
    return entries


def match_candidates(entries: list[dict], candidates: Path) -> list[dict]:
    lookup = {(e['fullName'], e['uf'], e['campaignOffice']): e for e in entries if e['campaignOffice']}
    matches: dict[int, dict[str, dict]] = {}
    with candidates.open(encoding="latin-1", newline="") as stream:
        for row in csv.DictReader(stream, delimiter=';'):
            # The 2022 archive also includes later supplementary contests. Exclude them.
            if row['ANO_ELEICAO'] != '2022' or row['DT_ELEICAO'] not in {'02/10/2022', '30/10/2022'}:
                continue
            entry = lookup.get((row['NM_CANDIDATO'], row['SG_UF'], row['DS_CARGO']))
            if entry is None:
                continue
            seq = row['SQ_CANDIDATO']
            found = matches.setdefault(entry['id'], {})
            if seq in found and cpf(found[seq]['NR_CPF_CANDIDATO']) != cpf(row['NR_CPF_CANDIDATO']):
                raise ValueError(f"Conflicting identity for {entry['name']}")
            found[seq] = row
    seeds = []
    for e in entries:
        candidates_for_person = matches.get(e['id'], {})
        if e['campaignOffice'] and len(candidates_for_person) != 1:
            raise ValueError(f"Expected exactly one reviewed 2022 candidacy for {e['name']}")
        row = next(iter(candidates_for_person.values()), {})
        doc = cpf(row.get('NR_CPF_CANDIDATO', ''))
        if row and not doc:
            raise ValueError(f"No exact private identity available for {e['name']}")
        office = {k: e[k] for k in ['verifiedAt', 'sourceUrl', 'note']}
        office.update(campaignYear=2022 if row else None, campaignOffice=row.get('DS_CARGO'), campaignParty=row.get('SG_PARTIDO'))
        seeds.append(dict(camara_id=e['id'], name=e['name'], civil_name=e['fullName'],
            full_name=e['fullName'], ballot_name=row.get('NM_URNA_CANDIDATO'), cpf=doc,
            party=None, uf=e['uf'], chamber=e['chamber'], photo=None,
            birth_date=datetime.strptime(row['DT_NASCIMENTO'], '%d/%m/%Y').date().isoformat() if row else None,
            sq_candidate=row.get('SQ_CANDIDATO'), office=office))
    return seeds


def load_executives(candidates: Path, cache_dir: str | Path) -> list[dict]:
    seeds = match_candidates(load_roster(), candidates)
    private = Path(cache_dir) / 'executives'
    private.mkdir(parents=True, exist_ok=True)
    # Only private caches contain CPF and candidacy IDs; public serializers whitelist fields.
    (private / 'identities.json').write_text(json.dumps({str(s['camara_id']): s['cpf'] for s in seeds if s['cpf']}))
    return seeds
