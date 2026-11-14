import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from datetime import date
from grafobr_pipeline.state_contracts import (
    normalize,
    valid_cnpj,
    clean,
    collect_day,
    collect_consistent_day,
    graph_fingerprint,
)

ROW = {
    "numeroControlePNCP": "00394460000141-2-000001/2026",
    "anoContrato": 2026,
    "sequencialContrato": 1,
    "orgaoEntidade": {
        "cnpj": "00394460000141",
        "esferaId": "E",
        "poderId": "E",
        "razaoSocial": "Órgão estadual",
    },
    "unidadeOrgao": {"ufSigla": "SP", "nomeUnidade": "Unidade"},
    "tipoContrato": {"id": 1},
    "receita": False,
    "tipoPessoa": "PJ",
    "niFornecedor": "33000167000101",
    "nomeRazaoSocialFornecedor": "Fornecedor",
    "valorInicial": 123.4567,
    "numeroContratoEmpenho": "123",
    "objetoContrato": "Aquisição",
    "dataPublicacaoPncp": "2026-10-01T10:00:00",
    "dataAtualizacao": "2026-10-02T10:00:00",
}


class StateContractsTests(unittest.TestCase):
    def test_identity_validation_and_stable_registry(self):
        self.assertEqual(valid_cnpj("33.000.167/0001-01"), "33000167000101")
        self.assertIsNone(valid_cnpj("33000167000102"))
        self.assertIsNone(valid_cnpj("abc33000167000101"))
        registry = {}
        a, root = normalize(ROW, registry)
        b, _ = normalize(ROW, registry)
        self.assertEqual(a["supplierId"], b["supplierId"])
        self.assertEqual(root, "33000167")
        self.assertEqual(a["initialValue"], 123.4567)
        self.assertNotIn("niFornecedor", a)
        self.assertNotIn(
            root, json.dumps({k: v for k, v in a.items() if k != "sourceUrl"})
        )

    def test_unsupported_records_are_excluded_not_conflated(self):
        for change, reason in [
            ({"tipoPessoa": "PF"}, "notCompany"),
            ({"tipoContrato": {"id": 7}}, "otherInstrument"),
            ({"receita": True}, "revenueOrUnknown"),
            ({"orgaoSubRogado": {"cnpj": "x"}}, "transferred"),
            ({"valorInicial": None}, "invalidAmount"),
            ({"valorInicial": "NaN"}, "invalidAmount"),
            ({"valorInicial": "1e999"}, "invalidAmount"),
            ({"valorInicial": -1}, "invalidAmount"),
            ({"niFornecedor": "00000000000000"}, "invalidCompanyId"),
        ]:
            self.assertEqual(normalize({**ROW, **change}, {})[1], reason)
        municipal = copy.deepcopy(ROW)
        municipal["orgaoEntidade"]["esferaId"] = "M"
        self.assertEqual(normalize(municipal, {})[1], "outsideScope")

    def test_zero_is_valid_and_private_documents_are_removed(self):
        self.assertEqual(
            normalize({**ROW, "valorInicial": 0}, {})[0]["initialValue"], 0
        )
        self.assertNotIn("123", clean("CPF 123.456.789-09 ou 12345678909"))
        self.assertNotIn("33000167", clean("33000167000101"))

    def test_pagination_fails_closed(self):
        first = {
            "data": [ROW],
            "totalRegistros": 2,
            "totalPaginas": 2,
            "numeroPagina": 1,
        }
        with patch(
            "grafobr_pipeline.state_contracts.fetch_page",
            side_effect=[first, {**first, "numeroPagina": 2}],
        ):
            with self.assertRaisesRegex(ValueError, "Duplicate"):
                collect_day(date(2026, 10, 1), Path("/unused"))
        with patch(
            "grafobr_pipeline.state_contracts.fetch_page",
            return_value={**first, "totalRegistros": 3, "totalPaginas": 1},
        ):
            with self.assertRaisesRegex(ValueError, "Incomplete"):
                collect_day(date(2026, 10, 1), Path("/unused"))
        with patch(
            "grafobr_pipeline.state_contracts.fetch_page",
            side_effect=[first, {**first, "numeroPagina": 2, "totalRegistros": 3}],
        ):
            with self.assertRaisesRegex(ValueError, "pagination changed"):
                collect_day(date(2026, 10, 1), Path("/unused"))

    def test_identity_fingerprint_ignores_timestamps_but_detects_reassignment(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "1.json"
            g = {
                "meta": {"generatedAt": "old"},
                "nodes": [{"id": 2, "entityId": "e1", "name": "A"}],
            }
            p.write_text(json.dumps(g))
            first = graph_fingerprint(Path(tmp))
            g["meta"]["generatedAt"] = "new"
            p.write_text(json.dumps(g))
            self.assertEqual(first, graph_fingerprint(Path(tmp)))
            g["nodes"][0]["entityId"] = "e2"
            p.write_text(json.dumps(g))
            self.assertNotEqual(first, graph_fingerprint(Path(tmp)))

    def test_changed_day_is_quarantined_and_refetched(self):
        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp) / "pages"
            cache.mkdir()
            old = cache / "2026-10-01-1.json"
            old.write_text("old page")
            result = ([], {"date": "2026-10-01", "nationalRecords": 0})
            with patch(
                "grafobr_pipeline.state_contracts.collect_day",
                side_effect=[ValueError("changed pagination"), result],
            ):
                self.assertEqual(
                    collect_consistent_day(date(2026, 10, 1), cache), result
                )
            self.assertFalse(old.exists())
            self.assertEqual(len(list((Path(tmp) / "rejected").glob("*/*.json"))), 1)
