"""Independent federal PNCP snapshot. Federal sphere, never location, defines scope."""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import fcntl
import hashlib
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from jsonschema import validate
from . import state_contracts as pncp
from .contract_history import advance, atomic_json, baseline, now

UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO EX'.split()
SCHEMA = Path(__file__).resolve().parents[3] / 'contract/federal-contracts.schema.json'


def in_scope(row):
    return row.get('orgaoEntidade', {}).get('esferaId') == 'F'


def normalize(row, registry):
    contract, reason = pncp.normalize(row, registry, scope=in_scope)
    if contract:
        contract['sphere'] = 'F'
        contract['agencyId'] = 'a' + hashlib.sha256(pncp.valid_cnpj(row['orgaoEntidade']['cnpj']).encode()).hexdigest()[:20]
    return contract, reason


def page_receipt(cache, days):
    """Hash every expected page, fail on missing pages; never fetch on cache reuse."""
    receipt = {}
    for day in days:
        first = cache / f'{day}-1.json'
        if not first.exists():
            raise ValueError(f'Missing cached PNCP day {day}')
        pages = json.loads(first.read_text())['totalPaginas']
        for page in range(1, max(pages, 1) + 1):
            path = cache / f'{day}-{page}.json'
            if not path.exists():
                raise ValueError(f'Missing cached PNCP page {day}/{page}')
            receipt[path.name] = {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                                  'collectedAt': datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()}
    return receipt


def build(args, previous=None):
    start, end = date.fromisoformat(args.start), date.fromisoformat(args.end)
    if start > end or end >= datetime.now(ZoneInfo('America/Sao_Paulo')).date():
        raise ValueError('Use a nonempty publication period ending before today')
    days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    cache = Path(args.cache_dir)
    cache.mkdir(parents=True, exist_ok=True)
    registry_path = cache.parent / 'federal-supplier-identities.json'
    if previous and not registry_path.exists():
        raise ValueError('Missing persistent federal supplier registry')
    registry = json.loads(registry_path.read_text()) if registry_path.exists() else {}
    prior_receipt = None
    if args.reuse_cache:
        if previous:
            raise ValueError('Cache reuse is only for the first baseline; refresh must refetch all days')
        prior_receipt = page_receipt(cache, days)
        times = [p['collectedAt'] for p in prior_receipt.values()]
        if max(times) > now():
            raise ValueError('Cached collection timestamp is in the future')
        batches = [pncp.collect_day(day, cache, scope=in_scope, count_key='federalRecords', cached_only=True) for day in days]
    else:
        for day in days:
            for path in cache.glob(f'{day}-*.json'):
                path.unlink()
        with ThreadPoolExecutor(max_workers=8) as pool:
            batches = list(pool.map(lambda day: pncp.collect_consistent_day(day, cache, scope=in_scope, count_key='federalRecords'), days))
    receipt = page_receipt(cache, days)
    if prior_receipt is not None and receipt != prior_receipt:
        raise ValueError('Cached collection changed during validation')
    times = [p['collectedAt'] for p in receipt.values()]
    contracts, exclusions, seen = [], Counter(), set()
    grouped = defaultdict(list)
    for rows, _ in batches:
        for row in rows:
            key = row['numeroControlePNCP']
            if key in seen:
                raise ValueError('Duplicate PNCP contract across publication days')
            seen.add(key)
            contract, reason = normalize(row, registry)
            if contract:
                contracts.append(contract)
                grouped[contract['supplierId']].append(contract)
            else:
                exclusions[reason] += 1
    suppliers = [{'id': key, 'name': max(rows, key=lambda c: c['updatedAt'])['supplierName'],
                  'aliases': sorted({c['supplierName'] for c in rows})} for key, rows in sorted(grouped.items())]
    contracts.sort(key=lambda c: (-c['initialValue'], c['id']))
    result = {'schemaVersion': 1, 'scope': 'F', 'fetchedAt': max(times),
              'collection': {'mode': 'validated-cache' if args.reuse_cache else 'fresh',
                             'startedAt': min(times), 'finishedAt': max(times)},
              'period': {'start': str(start), 'end': str(end), 'basis': 'publication'},
              'source': pncp.API, 'coverage': {'states': UFS,
                  'nationalRecordsChecked': sum(a['nationalRecords'] for _, a in batches),
                  'federalRecordsChecked': len(seen), 'excluded': dict(exclusions),
                  'days': [a for _, a in batches]}, 'suppliers': suppliers, 'contracts': contracts}
    result['version'] = hashlib.sha256(json.dumps({k: v for k, v in result.items() if k not in ('fetchedAt', 'collection')}, sort_keys=True).encode()).hexdigest()[:16]
    if previous:
        if result['fetchedAt'] <= previous['fetchedAt']:
            raise ValueError('Federal source freshness must advance on a new consultation')
        advance(previous, result)
    else:
        result['history'] = baseline(result)
    validate(result, json.loads(SCHEMA.read_text()))
    # Persist private identities before publication, so an interrupted publish never reassigns IDs.
    atomic_json(registry_path, registry, private=True)
    atomic_json(cache.parent / 'federal-collection-receipt.json', receipt, private=True)
    return result


def refresh(args, builder=build):
    output = Path(args.output)
    committed = Path(args.public_dir) / '_federal-contracts.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.with_suffix('.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        prior = output if output.exists() else committed
        previous = json.loads(prior.read_text()) if prior.exists() else None
        if previous:
            validate(previous, json.loads(SCHEMA.read_text()))
        attempted = now()
        try:
            candidate = builder(args, previous)
            candidate['refresh'] = {'status': 'success', 'attemptedAt': attempted, 'lastSuccessAt': candidate['fetchedAt']}
            validate(candidate, json.loads(SCHEMA.read_text()))
            atomic_json(output, candidate)
            print(f"Federal: {len(candidate['contracts'])} contracts, {len(candidate['suppliers'])} suppliers; version {candidate['version']}")
            return candidate
        except BaseException:
            if previous:
                previous['refresh'] = {'status': 'failed', 'attemptedAt': attempted, 'lastSuccessAt': previous['fetchedAt']}
                atomic_json(output, previous)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start', required=True)
    parser.add_argument('--end', required=True)
    parser.add_argument('--cache-dir', default='.cache/pncp/federal-publications')
    parser.add_argument('--public-dir', default='../web/public/data')
    parser.add_argument('--output', default='../data/_federal-contracts.json')
    parser.add_argument('--reuse-cache', action='store_true', help='Initial baseline only: validate every cached page, preserving original collection timestamps')
    refresh(parser.parse_args())


if __name__ == '__main__':
    main()
