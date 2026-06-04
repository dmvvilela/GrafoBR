from pathlib import Path
import json
import unittest

import duckdb

from grafobr_pipeline.build_ego_networks import (
    BuildContext,
    _load_receita_qsa,
    _load_transparencia_contracts,
    expand_ego_network,
    to_contract,
)
from grafobr_pipeline.emit import validate
from grafobr_pipeline.transparencia import iter_contracts_csv, parse_brl


FIXTURES = Path(__file__).parent / "fixtures"


class TransparenciaContractsTest(unittest.TestCase):
    def test_iter_contracts_csv_filters_and_normalizes_rows(self) -> None:
        contracts = iter_contracts_csv(FIXTURES / "transparencia_contratos_sample.csv")

        self.assertEqual(len(contracts), 2)
        self.assertEqual(contracts[0]["cnpj_root"], "11222333")
        self.assertEqual(contracts[0]["value"], 1_500_000.0)
        self.assertEqual(contracts[0]["contracting_org"], "MINISTERIO DA SAUDE")

    def test_parse_brl_caps_absurd_values(self) -> None:
        self.assertEqual(parse_brl("R$ 1.000,50"), 1000.50)
        self.assertIsNone(parse_brl("50.000.000.000,00"))

    def test_contract_edges_attach_to_existing_company_nodes(self) -> None:
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
        _load_transparencia_contracts(
            con,
            str(FIXTURES / "transparencia_contratos_sample.csv"),
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
        contract = to_contract(expand_ego_network(con, seed, BuildContext()), seed)
        validate(contract)

        contrato_links = [
            link for link in contract["links"] if link["connectionType"] == "contrato"
        ]
        self.assertEqual(len(contrato_links), 1)
        self.assertIn("transparencia", contract["meta"]["sources"])

        serialized = json.dumps(contract, ensure_ascii=False)
        self.assertNotIn("97506060353", serialized)
        self.assertNotIn("11222333000181", serialized)
        self.assertNotIn("11222333", serialized)


if __name__ == "__main__":
    unittest.main()
