import copy
from datetime import date
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from jsonschema import validate
from grafobr_pipeline import federal_contracts as federal
from grafobr_pipeline import state_contracts as state
from grafobr_pipeline.contract_history import advance
from test_state_contracts import ROW


def row(uf='DF', sphere='F', sequence=1):
    r = copy.deepcopy(ROW)
    r['orgaoEntidade']['esferaId'] = sphere
    r['unidadeOrgao']['ufSigla'] = uf
    r['numeroControlePNCP'] = f'00394460000141-2-{sequence:06d}/2026'
    r['sequencialContrato'] = sequence
    return r


def fixture(tmp):
    cache = Path(tmp) / 'pages'
    cache.mkdir()
    rows = [row(), row('DF', 'D', 2), row('RJ', 'E', 3), row('AC', 'F', 4)]
    (cache / '2026-10-01-1.json').write_text(json.dumps({'data': rows, 'totalRegistros': 4, 'totalPaginas': 1, 'numeroPagina': 1}))
    return SimpleNamespace(start='2026-10-01', end='2026-10-01', cache_dir=str(cache), reuse_cache=True,
                           output=str(Path(tmp) / '_federal-contracts.json'), public_dir=tmp)


class FederalContractsTests(unittest.TestCase):
    def test_synthetic_seam_fixture_matches_schema(self):
        sample = federal.SCHEMA.parent / "sample-federal-contracts.json"
        validate(json.loads(sample.read_text()), json.loads(federal.SCHEMA.read_text()))

    def test_scope_uses_federal_sphere_in_every_location_never_df_geography(self):
        for uf in federal.UFS:
            for sphere in ['F', 'D', 'E', 'M', 'N', None]:
                r = row(uf, sphere)
                result, _ = federal.normalize(r, {})
                self.assertEqual(result is not None, sphere == 'F')
                if result:
                    self.assertEqual(result['sphere'], 'F')
                    self.assertEqual(result['uf'], uf)
                    self.assertIsNone(state.normalize(r, {})[0])
                    validate(result, json.loads(federal.SCHEMA.read_text())['properties']['contracts']['items'])

    def test_cache_import_checks_all_pages_without_network_or_freshness_inflation(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = fixture(tmp)
            with patch.object(state.requests, 'get', side_effect=AssertionError('No network on explicit cache reuse')):
                result = federal.build(args)
            self.assertEqual(len(result['contracts']), 2)
            self.assertEqual(result['coverage']['nationalRecordsChecked'], 4)
            self.assertEqual(result['coverage']['federalRecordsChecked'], 2)
            self.assertEqual(result['history']['events'], [])
            receipt = federal.page_receipt(Path(args.cache_dir), [date(2026, 10, 1)])
            self.assertEqual(result['fetchedAt'], max(p['collectedAt'] for p in receipt.values()))
            self.assertEqual(result['collection']['mode'], 'validated-cache')
            self.assertNotIn('niFornecedor', json.dumps(result))
            self.assertNotIn('33000167000101', json.dumps(result))
            with self.assertRaisesRegex(ValueError, 'only for the first baseline'):
                federal.build(args, result)

    def test_missing_or_inconsistent_cache_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = fixture(tmp)
            path = Path(args.cache_dir) / '2026-10-01-1.json'
            page = json.loads(path.read_text())
            page['totalPaginas'] = 2
            path.write_text(json.dumps(page))
            with self.assertRaisesRegex(ValueError, 'Missing cached PNCP page'):
                federal.build(args)
            page['totalPaginas'] = 1
            page['totalRegistros'] = 5
            path.write_text(json.dumps(page))
            with self.assertRaisesRegex(ValueError, 'Incomplete'):
                federal.build(args)

    def test_failed_refresh_preserves_federal_records_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = fixture(tmp)
            prior = federal.refresh(args)
            def fail(*args):
                raise ValueError('incomplete source')
            with self.assertRaisesRegex(ValueError, 'incomplete source'):
                federal.refresh(args, builder=fail)
            after = json.loads(Path(args.output).read_text())
            for key in ['contracts', 'suppliers', 'version', 'fetchedAt', 'history']:
                self.assertEqual(after[key], prior[key])
            self.assertEqual(after['refresh']['status'], 'failed')

    def test_history_is_federal_only_and_rejects_smaller_windows(self):
        with tempfile.TemporaryDirectory() as tmp:
            before = federal.build(fixture(tmp))
            after = copy.deepcopy(before)
            after['version'] = 'revised'
            after['fetchedAt'] = '2026-11-16T00:00:00+00:00'
            after['contracts'][0]['initialValue'] += 10
            advance(before, after)
            self.assertEqual(len(after['history']['events']), 1)
            self.assertEqual(after['history']['events'][0]['kind'], 'changed')
            self.assertEqual(after['history']['events'][0]['after']['sphere'], 'F')
            validate(after, json.loads(federal.SCHEMA.read_text()))
            after['period']['start'] = '2026-10-02'
            with self.assertRaisesRegex(ValueError, 'cannot shrink'):
                advance(before, after)
