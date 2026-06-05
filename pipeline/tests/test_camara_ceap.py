from pathlib import Path
import json
import unittest

import duckdb

from grafobr_pipeline.build_ego_networks import (
    BuildContext,
    _load_camara_expenses,
    expand_ego_network,
    to_contract,
)
from grafobr_pipeline.camara import iter_ceap_expenses, parse_ceap_amount
from grafobr_pipeline.emit import validate


FIXTURES = Path(__file__).parent / "fixtures"


class CamaraCeapTest(unittest.TestCase):
    def test_iter_ceap_expenses_filters_and_normalizes_rows(self) -> None:
        rows = list(iter_ceap_expenses(FIXTURES / "camara_ceap_sample.csv"))

        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0]["deputy_id"], 204549)
        self.assertEqual(rows[0]["supplier_doc"], "11222333000181")
        self.assertEqual(rows[0]["amount"], 1200.50)
        self.assertEqual(rows[0]["supplier_name"], "POSTO EXEMPLO LTDA")
        self.assertEqual(parse_ceap_amount("1.234,56"), 1234.56)
        self.assertEqual(parse_ceap_amount("106.19"), 106.19)

    def test_ceap_edges_attach_to_seed_without_leaking_supplier_doc(self) -> None:
        con = duckdb.connect(database=":memory:")
        con.execute(
            """
            create table tse_receipts (
              sq_candidate varchar,
              donor_key varchar,
              donor_name varchar,
              receipt_date varchar,
              amount double
            )
            """
        )
        _load_camara_expenses(con, FIXTURES / "camara_ceap_sample.csv")

        seed = {
            "camara_id": 204549,
            "name": "AJ Albuquerque",
            "civil_name": "ANTONIO JOSE AGUIAR ALBUQUERQUE",
            "cpf": "97506060353",
            "party": "PP",
            "uf": "CE",
            "sq_candidate": "123",
            "ballot_name": "AJ ALBUQUERQUE",
            "full_name": "ANTONIO JOSE AGUIAR ALBUQUERQUE",
        }
        contract = to_contract(expand_ego_network(con, seed, BuildContext()), seed)
        validate(contract)

        expense_links = [
            link for link in contract["links"] if link["connectionType"] == "despesa"
        ]
        self.assertEqual(len(expense_links), 1)
        self.assertIn("camara_ceap", contract["meta"]["sources"])
        self.assertIn("R$1.500,50", expense_links[0]["description"])

        serialized = json.dumps(contract, ensure_ascii=False)
        self.assertIn("POSTO EXEMPLO LTDA", serialized)
        self.assertNotIn("11222333000181", serialized)
        self.assertNotIn("97506060353", serialized)


if __name__ == "__main__":
    unittest.main()
