from pathlib import Path
import unittest

import duckdb

from grafobr_pipeline.build_ego_networks import (
    BuildContext,
    _load_receita_qsa,
    expand_ego_network,
    to_contract,
)


FIXTURES = Path(__file__).parent / "fixtures"


class ReceitaQsaTest(unittest.TestCase):
    def test_masked_qsa_match_uses_middle_six_plus_name(self) -> None:
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
        _load_receita_qsa(
            con,
            str(FIXTURES / "receita_empresas_sample.csv"),
            str(FIXTURES / "receita_socios_sample.csv"),
        )

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
        graph = expand_ego_network(con, seed, BuildContext())
        contract = to_contract(graph, seed)

        socio_links = [
            link for link in contract["links"] if link["connectionType"] == "socio"
        ]
        self.assertEqual(len(socio_links), 1)
        self.assertIn("receita", contract["meta"]["sources"])

        serialized = str(contract)
        self.assertNotIn("97506060353", serialized)
        self.assertNotIn("11222333000181", serialized)


if __name__ == "__main__":
    unittest.main()
