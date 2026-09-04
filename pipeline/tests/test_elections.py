import csv
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker
from grafobr_pipeline.elections import build, ROOT, private_profile_ids

class ElectionsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.doc = "12345678901"  # synthetic test-only document
        self.index = [{"id": 7, "name": "Pessoa Exemplo", "chamber": "camara"}]
        self.row = {"ANO_ELEICAO": "2026", "SQ_CANDIDATO": "123", "NR_CPF_CANDIDATO": self.doc,
          "NM_CANDIDATO": "PESSOA EXEMPLO", "DS_CARGO": "DEPUTADO FEDERAL", "SG_UF": "SP",
          "SG_PARTIDO": "EX", "NR_CANDIDATO": "1234", "DS_SITUACAO_CANDIDATURA": "CADASTRADO",
          "DT_GERACAO": "01/09/2026", "HH_GERACAO": "12:00:00"}

    def write(self, name, rows):
        path = self.root / name
        with path.open("w", encoding="latin-1", newline="") as f:
            w = csv.DictWriter(f, fieldnames=rows[0].keys(), delimiter=";")
            w.writeheader(); w.writerows(rows)
        return path

    def run_build(self, rows, receipts=None):
        return build(self.write("candidates.csv", rows), receipts, self.index, {self.doc: 7})

    def test_only_exact_match_no_cpf_published(self):
        payload = self.run_build([self.row])
        self.assertEqual(payload["matchedProfiles"], 1)
        self.assertIsNone(payload["entries"][0]["totalReceived"])
        self.assertNotIn(self.doc, json.dumps(payload))
        self.assertNotIn("SQ_CANDIDATO", json.dumps(payload))
        schema = json.loads((ROOT / "contract/elections.schema.json").read_text())
        Draft202012Validator(schema, format_checker=FormatChecker()).validate(payload)
        masked = self.run_build([{**self.row, "NR_CPF_CANDIDATO": "***456789**"}])
        self.assertEqual(masked["matchedProfiles"], 0)

    def test_ambiguous_candidacy_not_guessed_and_wrong_year_rejected(self):
        payload = self.run_build([self.row, {**self.row, "SQ_CANDIDATO": "456"}])
        self.assertEqual(payload["ambiguousProfiles"], 1)
        self.assertEqual(payload["entries"], [])
        with self.assertRaises(ValueError): self.run_build([{**self.row, "ANO_ELEICAO": "2022"}])

    def test_receipts_decimal_dedup_and_conflict(self):
        row = {"ANO_ELEICAO": "2026", "SQ_CANDIDATO": "123", "SQ_RECEITA": "1", "VR_RECEITA": "1.234,56", "DT_GERACAO": "01/09/2026", "HH_GERACAO": "12:00:00"}
        receipts = self.write("receipts.csv", [row, row, {**row, "SQ_RECEITA": "2", "VR_RECEITA": "0,44"}])
        entry = self.run_build([self.row], receipts)["entries"][0]
        self.assertEqual(entry["totalReceived"], 1235)
        self.assertEqual(entry["receiptCount"], 2)
        receipts = self.write("receipts.csv", [row, {**row, "VR_RECEITA": "9,00"}])
        with self.assertRaises(ValueError): self.run_build([self.row], receipts)

    def test_zip_reads_only_national_file(self):
        csv_path = self.write("candidates.csv", [self.row])
        archive = self.root / "candidates.zip"
        with zipfile.ZipFile(archive, "w") as z:
            z.write(csv_path, "consulta_cand_2026_BRASIL.csv")
            z.write(csv_path, "consulta_cand_2026_SP.csv")
        payload = build(archive, None, self.index, {self.doc: 7})
        self.assertEqual(payload["matchedProfiles"], 1)

    def test_same_sequence_cannot_belong_to_multiple_documents(self):
        with self.assertRaises(ValueError):
            self.run_build([self.row, {**self.row, "NR_CPF_CANDIDATO": "98765432109"}])

    def test_senator_and_duplicate_profile_identifiers_excluded(self):
        folder = self.root / "camara/deputados"
        folder.mkdir(parents=True)
        for id in [7, 8]:
            (folder / f"{id}.json").write_text(json.dumps({"dados": {"cpf": self.doc}}))
        duplicate = self.index + [{"id": 8, "chamber": "camara"}]
        self.assertEqual(private_profile_ids(duplicate, self.root), {})
        self.assertEqual(private_profile_ids([{ "id": 7, "chamber": "senado" }], self.root), {})
