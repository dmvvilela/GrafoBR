"""Static, reproducible DCA comparisons. No politician attribution or live API calls.

Uses liquidated annual spending, excluding intra-budget transactions. Function
totals (I-E) must reconcile; investment (I-D) is a separate economic classification.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import time
from urllib.parse import urlencode

import httpx
import jsonschema

ROOT = Path(__file__).resolve().parents[3]
BASE = 'https://apidatalake.tesouro.gov.br/ords/cdwhprd/siconfi/tt/dca'
POP_URL = 'https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/2024%7C2025/variaveis/9324?localidades=N3[all]'
STATES = dict(zip([11,12,13,14,15,16,17,21,22,23,24,25,26,27,28,29,31,32,33,35,41,42,43,50,51,52,53],
                 'RO AC AM RR PA AP TO MA PI CE RN PB PE AL SE BA MG ES RJ SP PR SC RS MS MT GO DF'.split()))
YEARS = [2024, 2025]
COLUMN = 'Despesas Liquidadas'


def api_url(code: int, year: int, annex: str) -> str:
    return BASE + '?' + urlencode(dict(an_exercicio=year, no_anexo=f'DCA-Anexo I-{annex}', id_ente=code))


class Fetcher:
    def __init__(self, cache: Path, refresh: bool = False):
        self.cache, self.refresh, self.last = cache, refresh, 0.0
        cache.mkdir(parents=True, exist_ok=True)
        self.client = httpx.Client(timeout=90, follow_redirects=True)

    def get(self, url: str) -> tuple[object, str]:
        path = self.cache / (hashlib.sha256(url.encode()).hexdigest() + '.json')
        if path.exists() and not self.refresh:
            cached = json.loads(path.read_text())
            age = datetime.now(timezone.utc) - datetime.fromisoformat(cached['fetchedAt'])
            if age.total_seconds() < 7 * 86400:
                return cached['data'], cached['fetchedAt']
        for attempt in range(4):
            # Treasury documents a maximum of one request per second.
            time.sleep(max(0, 1.1 - (time.monotonic() - self.last)))
            self.last = time.monotonic()
            try:
                response = self.client.get(url)
                response.raise_for_status()
                data = response.json()
                break
            except (httpx.HTTPError, ValueError):
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)
        stamp = datetime.now(timezone.utc).isoformat()
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(dict(url=url, fetchedAt=stamp, data=data), ensure_ascii=False))
        temp.replace(path)
        return data, stamp

    def rows(self, url: str) -> tuple[list[dict], str]:
        rows, offset, stamps = [], 0, []
        while True:
            page, stamp = self.get(url + (f'&offset={offset}' if offset else ''))
            if not isinstance(page, dict) or not isinstance(page.get('items'), list):
                raise ValueError('Unexpected Treasury response')
            if page.get('offset') != offset or page.get('count') != len(page['items']):
                raise ValueError('Inconsistent Treasury pagination')
            rows.extend(page['items']); stamps.append(stamp)
            if page.get('hasMore') is False:
                return rows, max(stamps)
            if page.get('hasMore') is not True or not page['items'] or len(rows) > 50000:
                raise ValueError('Incomplete Treasury pagination')
            offset += len(page['items'])


def amount(value) -> Decimal:
    d = Decimal(str(value))
    if not d.is_finite() or d < 0 or d != d.quantize(Decimal('.01')):
        raise ValueError('Invalid monetary value')
    return d


def checked_rows(rows: list[dict], code: int, year: int, annex: str) -> list[dict]:
    seen = set()
    for r in rows:
        if (r['exercicio'], r['cod_ibge'], r['uf'], r['anexo']) != (year, code, STATES[code], f'DCA-Anexo I-{annex}'):
            raise ValueError('Report identity mismatch')
        key = (r['rotulo'], r['coluna'], r['cod_conta'], r['conta'])
        if key in seen:
            raise ValueError('Duplicate report cell; do not sum revisions')
        seen.add(key)
    return [r for r in rows if r['coluna'] == COLUMN]


def normalize(e_rows: list[dict], d_rows: list[dict], code: int, year: int) -> dict:
    if not e_rows:
        return dict(status='missing', total=None, functions={}, investment=None)
    e = checked_rows(e_rows, code, year, 'E')
    if not e or any(r['rotulo'] != 'Total Geral da Despesa por Função' or r['cod_conta'] != 'TotalDespesas' for r in e):
        raise ValueError('Unexpected function table structure')
    by_name = {r['conta']: amount(r['valor']) for r in e}
    total = by_name['Despesas Exceto Intraorçamentárias']
    functions = {m[1]: by_name[r['conta']] for r in e if (m := re.fullmatch(r'(\d{2}) - (.+)', r['conta']))}
    if total <= 0 or abs(sum(functions.values()) - total) > Decimal('1.00'):
        raise ValueError(f'Function totals do not reconcile: {STATES[code]} {year}')
    investment = None
    if d_rows:
        d = checked_rows(d_rows, code, year, 'D')
        if any(r['rotulo'] != 'Padrão' for r in d):
            raise ValueError('Unexpected economic classification table')
        by_code = {r['cod_conta']: amount(r['valor']) for r in d}
        if len(by_code) != len(d):
            raise ValueError('Ambiguous economic account')
        # I-D's total includes intra-budget transactions; I-E exposes them separately.
        if abs(by_code['TotalDespesas'] - total - by_name.get('Despesas Intraorçamentárias', Decimal(0))) > Decimal('1.00'):
            raise ValueError(f'Annex totals disagree: {STATES[code]} {year}')
        parent = by_code.get('DO4.4.00.00.00.00')
        if parent is not None:
            modalities = {k: v for k, v in by_code.items() if re.fullmatch(r'D[OI]4\.4\.(?!00)\d{2}\.00\.00\.00', k)}
            if abs(sum(modalities.values()) - parent) > Decimal('1.00'):
                raise ValueError('Investment modalities do not reconcile')
            investment = sum(v for k, v in modalities.items() if k.startswith('DO'))
    return dict(status='available', total=float(total), functions={k:float(v) for k,v in functions.items()},
                investment=float(investment) if investment is not None else None)


def populations(data: list) -> dict:
    if len(data) != 1 or data[0]['id'] != '9324' or data[0]['unidade'] != 'Pessoas':
        raise ValueError('Unexpected IBGE variable')
    result = {}
    for series in data[0]['resultados'][0]['series']:
        place = series['localidade']; code = int(place['id'])
        if place['nivel']['id'] != 'N3' or code not in STATES or code in result:
            raise ValueError('Invalid or duplicate population geography')
        values = {str(y):int(series['serie'][str(y)]) for y in YEARS}
        if any(v <= 0 for v in values.values()):
            raise ValueError('Missing population denominator')
        result[code] = dict(name=place['nome'], values=values)
    if set(result) != set(STATES):
        raise ValueError('Population coverage incomplete')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--output', type=Path, default=ROOT / 'data/_state-spending.json')
    args = parser.parse_args()
    fetch = Fetcher(ROOT / 'pipeline/.cache/state-spending', args.refresh)
    pop_raw, pop_stamp = fetch.get(POP_URL)
    pop = populations(pop_raw)
    states = []
    for code, uf in STATES.items():
        records = []
        for year in YEARS:
            e_url, d_url = api_url(code, year, 'E'), api_url(code, year, 'D')
            e, e_stamp = fetch.rows(e_url); d, d_stamp = fetch.rows(d_url)
            record = normalize(e, d, code, year)
            records.append(dict(year=year, population=pop[code]['values'][str(year)],
                fetchedAt=max(e_stamp, d_stamp), sourceUrls=[e_url, d_url], **record))
            print(f'{uf} {year}: {record["status"]}', flush=True)
        states.append(dict(code=code, uf=uf, name=pop[code]['name'], records=records))
    substantive = dict(years=YEARS, states=[{**s, 'records':[{k:v for k,v in r.items() if k!='fetchedAt'} for r in s['records']]} for s in states])
    version = hashlib.sha256(json.dumps(substantive, sort_keys=True).encode()).hexdigest()[:16]
    result = dict(schemaVersion=1, version=version, fetchedAt=max(r['fetchedAt'] for s in states for r in s['records']),
        years=YEARS, basis='liquidated-excluding-intra', populationSource=dict(url=POP_URL, table='6579', fetchedAt=pop_stamp), states=states)
    jsonschema.validate(result, json.loads((ROOT/'contract/state-spending.schema.json').read_text()))
    # Commit a complete validated snapshot atomically; failures preserve existing output.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    temp.replace(args.output)
    print(f'Wrote {len(states)} states, {len(states)*len(YEARS)} annual records, version {version}', flush=True)


if __name__ == '__main__':
    main()
