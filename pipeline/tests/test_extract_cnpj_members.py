from pathlib import Path
import importlib.util
import sys
import tempfile
import unittest
import zipfile


SCRIPT = Path(__file__).parents[1] / "scripts" / "extract_cnpj_members.py"
spec = importlib.util.spec_from_file_location("extract_cnpj_members", SCRIPT)
assert spec and spec.loader
extract_cnpj_members = importlib.util.module_from_spec(spec)
sys.modules["extract_cnpj_members"] = extract_cnpj_members
spec.loader.exec_module(extract_cnpj_members)


class ExtractCnpjMembersTest(unittest.TestCase):
    def test_extracts_inner_cnpj_zip_from_outer_share_zip(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            temp_path = Path(temp)
            inner = temp_path / "Empresas0.zip"
            with zipfile.ZipFile(inner, "w") as archive:
                archive.writestr("K00001.EMPRECSV", "00000000;EMPRESA TESTE\n")

            outer = temp_path / "share.zip"
            with zipfile.ZipFile(outer, "w", compression=zipfile.ZIP_STORED) as archive:
                archive.writestr("Publico/Dados/Outro/ignorado.txt", "x")
                archive.writestr(
                    "Publico/Dados/Cadastros/CNPJ/2023-05/Empresas0.zip",
                    inner.read_bytes(),
                )
                archive.writestr("Publico/Dados/Cadastros/CNPJ/2023-05/Cnaes.zip", "x")

            output = temp_path / "out"
            status = extract_cnpj_members.extract_members(
                share_zip=outer,
                output_dir=output,
            )

            extracted = output / "2023-05" / "Empresas0.zip"
            self.assertEqual(status, 0)
            self.assertTrue(zipfile.is_zipfile(extracted))
            with zipfile.ZipFile(extracted) as archive:
                self.assertEqual(archive.read("K00001.EMPRECSV"), b"00000000;EMPRESA TESTE\n")


if __name__ == "__main__":
    unittest.main()
