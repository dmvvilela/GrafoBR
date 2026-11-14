"""Atomic PNCP snapshot + observed history. No cached page counts as a fresh check."""
from __future__ import annotations
import copy
import fcntl
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from types import SimpleNamespace


def now():
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path, value, private=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    with temporary.open('w') as file:
        if private:
            os.fchmod(file.fileno(), 0o600)
        json.dump(value, file, ensure_ascii=False, separators=(',', ':'))
        file.flush()
        os.fsync(file.fileno())
    temporary.replace(path)


def baseline(snapshot):
    return {'schemaVersion': 1, 'baselineAt': snapshot['fetchedAt'],
            'baselineVersion': snapshot['version'], 'sequence': 0, 'events': []}


def advance(previous, candidate):
    """Only compare a growing publication window; a disappearance is not a cancellation."""
    if previous['period']['start'] != candidate['period']['start'] or previous['period']['end'] > candidate['period']['end']:
        raise ValueError('Publication coverage cannot shrink or move its start')
    if previous['coverage']['states'] != candidate['coverage']['states']:
        raise ValueError('State coverage cannot change in this history')
    if previous['contracts'] and not candidate['contracts']:
        raise ValueError('Unexpected empty result for a previously populated window; review the source before publishing')
    history = copy.deepcopy(previous.get('history') or baseline(previous))
    before = {c['id']: c for c in previous['contracts']}
    after = {c['id']: c for c in candidate['contracts']}
    changes = []
    for key in sorted(before.keys() | after.keys()):
        old, new = before.get(key), after.get(key)
        if old == new:
            continue
        fields = sorted(k for k in (new or old) if k != 'id' and (old or {}).get(k) != (new or {}).get(k))
        sequence = history['sequence'] + 1
        event_id = 'h' + hashlib.sha256(json.dumps([sequence, key, old, new], sort_keys=True).encode()).hexdigest()[:20]
        changes.append({'id': event_id, 'sequence': sequence, 'observedAt': candidate['fetchedAt'],
                        'previousObservedAt': previous['fetchedAt'], 'fromVersion': previous['version'],
                        'toVersion': candidate['version'], 'kind': 'added' if old is None else 'removed' if new is None else 'changed',
                        'fields': fields, 'before': old, 'after': new})
    if changes:
        history['sequence'] += 1
        history['events'].extend(changes)
    candidate['history'] = history
    return candidate


def refresh(args, builder=None):
    from .state_contracts import build
    builder = builder or build
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    # OS releases the lock after a crash. No concurrent writer may change history/identities.
    with output.with_suffix('.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        committed = Path(getattr(args, 'graph_dir', output.parent)) / '_state-contracts.json'
        prior = output if output.exists() else committed
        previous = json.loads(prior.read_text()) if prior.exists() else None
        if previous:
            from jsonschema import validate
            schema = Path(__file__).resolve().parents[3] / 'contract/state-contracts.schema.json'
            validate(previous, json.loads(schema.read_text()))
        started = now()
        if previous:
            previous.setdefault('history', baseline(previous))
            previous['refresh'] = {'status': 'running', 'attemptedAt': started, 'lastSuccessAt': previous['fetchedAt']}
            atomic_json(output, previous)
        candidate_path = output.with_suffix('.candidate')
        try:
            if previous and not (Path(args.cache_dir).parent / 'state-supplier-identities.json').exists():
                raise ValueError('Missing persistent supplier identity registry')
            candidate_args = SimpleNamespace(**vars(args))
            candidate_args.output = str(candidate_path)
            candidate_args.refresh = True  # Always recheck every day, including old records.
            candidate = builder(candidate_args)
            if previous:
                candidate = advance(previous, candidate)
            else:
                candidate['history'] = baseline(candidate)
            candidate['refresh'] = {'status': 'success', 'attemptedAt': started, 'lastSuccessAt': candidate['fetchedAt']}
            from jsonschema import validate
            schema = Path(__file__).resolve().parents[3] / 'contract/state-contracts.schema.json'
            validate(candidate, json.loads(schema.read_text()))
            atomic_json(output, candidate)
            print(f"History: {len(candidate['history']['events'])} observed changes; sequence {candidate['history']['sequence']}", flush=True)
            return candidate
        except BaseException:
            if previous:
                previous['refresh'] = {'status': 'failed', 'attemptedAt': started, 'lastSuccessAt': previous['fetchedAt']}
                atomic_json(output, previous)
            raise
        finally:
            candidate_path.unlink(missing_ok=True)
