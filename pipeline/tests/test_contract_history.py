import copy
import fcntl
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from grafobr_pipeline.contract_history import advance, baseline, refresh

SOURCE = Path(__file__).resolve().parents[2] / 'web/public/data/_state-contracts.json'


def fixture():
    data = json.loads(SOURCE.read_text())
    data['contracts'] = data['contracts'][:2]
    data.pop('history', None)
    data.pop('refresh', None)
    return data


class HistoryTests(unittest.TestCase):
    def test_baseline_noop_then_field_changes_and_reappearance(self):
        old = fixture()
        same = advance(old, copy.deepcopy(old))
        self.assertEqual(same['history']['events'], [])
        new = copy.deepcopy(same)
        new['fetchedAt'] = '2026-11-15T01:00:00+00:00'
        new['contracts'][0]['initialValue'] = 0
        removed = new['contracts'].pop()
        new['version'] = 'next'
        advanced = advance(same, new)
        events = advanced['history']['events']
        self.assertEqual({e['kind'] for e in events}, {'changed', 'removed'})
        changed = next(e for e in events if e['kind'] == 'changed')
        self.assertEqual(changed['fields'], ['initialValue'])
        self.assertEqual(changed['after']['initialValue'], 0)
        self.assertEqual(advanced['history']['sequence'], 1)
        self.assertEqual(advance(advanced, copy.deepcopy(advanced))['history'], advanced['history'])
        returned = copy.deepcopy(advanced)
        returned['contracts'].append(removed)
        returned = advance(advanced, returned)
        self.assertEqual(returned['history']['events'][-1]['kind'], 'added')
        self.assertEqual(returned['history']['sequence'], 2)
        self.assertEqual(old.get('history'), None)  # No mutation of prior snapshot.

    def test_cannot_turn_shrunken_coverage_into_removals(self):
        old = fixture()
        for start, end in [('2026-10-02',old['period']['end']), (old['period']['start'],'2026-10-31')]:
            new = copy.deepcopy(old); new['period'].update(start=start,end=end)
            with self.assertRaises(ValueError): advance(old,new)

    def test_unexpected_empty_window_requires_review(self):
        old = fixture(); new = copy.deepcopy(old); new['contracts'] = []
        with self.assertRaises(ValueError): advance(old, new)

    def test_failed_or_invalid_refresh_keeps_snapshot_history_and_dates(self):
        for failure in ['network','schema']:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                path = Path(directory)
                old = fixture();old['history'] = baseline(old)
                output = path/'snapshot.json';output.write_text(json.dumps(old))
                (path/'state-supplier-identities.json').write_text('{}')
                args = SimpleNamespace(output=str(output),cache_dir=str(path/'pages'))
                def builder(candidate_args):
                    self.assertTrue(candidate_args.refresh)
                    self.assertNotEqual(candidate_args.output, str(output))
                    if failure == 'network': raise TimeoutError('private error must not be published')
                    result = copy.deepcopy(old);result['contracts'][0]['initialValue'] = -1
                    return result
                with self.assertRaises(Exception): refresh(args,builder)
                result = json.loads(output.read_text())
                self.assertEqual(result['contracts'], old['contracts'])
                self.assertEqual(result['history'], old['history'])
                self.assertEqual(result['fetchedAt'], old['fetchedAt'])
                self.assertEqual(result['refresh']['status'], 'failed')
                self.assertNotIn('private error', output.read_text())

    def test_success_commits_record_and_history_together_and_lock_rejects_second_writer(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory);old = fixture();output=path/'snapshot.json';output.write_text(json.dumps(old))
            (path/'state-supplier-identities.json').write_text('{}')
            args = SimpleNamespace(output=str(output),cache_dir=str(path/'pages'))
            candidate=copy.deepcopy(old);candidate['contracts'][0]['initialValue']=0
            result=refresh(args,lambda _:candidate)
            self.assertEqual(result,json.loads(output.read_text()))
            self.assertEqual(result['history']['events'][0]['after']['initialValue'],0)
            with output.with_suffix('.lock').open('w') as lock:
                fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
                with self.assertRaises(BlockingIOError):refresh(args,lambda _:candidate)
            self.assertEqual(json.loads(output.read_text())['refresh']['status'],'success')

    def test_fresh_checkout_restores_committed_history_and_missing_registry_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            committed = path / 'public'
            committed.mkdir()
            old = fixture()
            (committed / '_state-contracts.json').write_text(json.dumps(old))
            output = path / 'snapshot.json'
            args = SimpleNamespace(output=str(output), cache_dir=str(path/'pages'), graph_dir=str(committed))
            calls = []
            def builder(_):
                calls.append(True)
                result = copy.deepcopy(old)
                result['contracts'][0]['initialValue'] = 0
                return result
            with self.assertRaisesRegex(ValueError, 'Missing persistent'):
                refresh(args, builder)
            self.assertEqual(calls, [])
            self.assertEqual(json.loads(output.read_text())['contracts'], old['contracts'])
            output.unlink()
            (path/'state-supplier-identities.json').write_text('{}')
            result = refresh(args, builder)
            self.assertEqual(result['history']['baselineVersion'], old['version'])
            self.assertEqual(len(result['history']['events']), 1)
