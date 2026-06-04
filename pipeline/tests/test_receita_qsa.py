from pathlib import Path
import tempfile
import unittest
import zipfile

import duckdb

from grafobr_pipeline.build_ego_networks import (
    BuildContext,
    _load_receita_qsa,
    expand_ego_network,
    to_contract,
)
from grafobr_pipeline.receita import iter_empresas_csv, iter_socios_csv, slice_qsa_sources


FIXTURES = Path(__file__).parent / "fixtures"


class ReceitaQsaTest(unittest.TestCase):
    def test_slice_qsa_sources_writes_scoped_inputs_from_zips(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            temp_path = Path(temp)
            empresas_zip = temp_path / "Empresas0.zip"
            socios_zip = temp_path / "Socios0.zip"
            with zipfile.ZipFile(empresas_zip, "w") as archive:
                archive.write(
                    FIXTURES / "receita_empresas_sample.csv",
                    arcname="Empresas0.csv",
                )
            with zipfile.ZipFile(socios_zip, "w") as archive:
                archive.write(
                    FIXTURES / "receita_socios_sample.csv",
                    arcname="Socios0.csv",
                )

            scoped = slice_qsa_sources(
                empresas_inputs=[empresas_zip],
                socios_inputs=[socios_zip],
                target_cpfs=["97506060353"],
                output_dir=temp_path / "scoped",
            )

            self.assertEqual(scoped.matched_socios, 1)
            self.assertEqual(scoped.matched_companies, 1)

            companies = iter_empresas_csv(scoped.empresas_csv)
            socios = iter_socios_csv(scoped.socios_csv)
            self.assertEqual(companies[0]["razao_social"], "EMPRESA EXEMPLO QSA LTDA")
            self.assertEqual(socios[0]["socio_doc"], "060603")

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
