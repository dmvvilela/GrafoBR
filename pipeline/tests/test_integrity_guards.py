from copy import deepcopy
import json
from pathlib import Path
import unittest

import duckdb

from grafobr_pipeline.build_ego_networks import BuildContext, expand_ego_network, to_contract
from grafobr_pipeline.emit import validate


ROOT = Path(__file__).parents[2]


class IntegrityGuardsTest(unittest.TestCase):
    def test_same_display_name_does_not_create_shared_identity(self) -> None:
        registry: dict[str, str] = {}
        entity_ids = []
        for ego_id, private_key in ((1, "donor:private-a"), (2, "donor:private-b")):
            seed = {"camara_id": ego_id, "name": f"Político {ego_id}"}
            raw = {
                "nodes": [
                    {
                        "key": f"camara:{ego_id}",
                        "name": seed["name"],
                        "category": "politician",
                    },
                    {
                        "key": private_key,
                        "name": "MESMO NOME",
                        "category": "donor",
                    },
                ],
                "links": [
                    {
                        "source": private_key,
                        "target": f"camara:{ego_id}",
                        "connectionType": "doacao",
                        "description": "registro de teste",
                        "strength": 1,
                    }
                ],
            }
            contract = to_contract(raw, seed, BuildContext(), registry)
            entity_ids.append(
                next(node["entityId"] for node in contract["nodes"] if node["category"] == "donor")
            )

        self.assertNotEqual(entity_ids[0], entity_ids[1])

    def test_semantic_validation_rejects_duplicate_node_ids(self) -> None:
        sample = json.loads(
            (ROOT / "contract" / "sample-ego-network.json").read_text(encoding="utf-8")
        )
        broken = deepcopy(sample)
        broken["nodes"][1]["id"] = broken["nodes"][0]["id"]

        with self.assertRaises(ValueError):
            validate(broken)

    def test_ambiguous_emenda_author_is_omitted(self) -> None:
        con = duckdb.connect(database=":memory:")
        con.execute(
            """
            create table tse_receipts (
              sq_candidate varchar, donor_key varchar, donor_name varchar,
              receipt_date varchar, amount double
            );
            create table emendas (
              normalized_author varchar, author_id varchar, uf varchar,
              funcao varchar, empenhado double, pago double, n integer,
              ano_min integer, ano_max integer
            );
            insert into emendas values
              ('nome exemplo', '100', 'SP', 'Saúde', 1000, 500, 1, 2023, 2023),
              ('nome exemplo', '200', 'SP', 'Educação', 2000, 1000, 1, 2023, 2023);
            """
        )
        seed = {
            "camara_id": 123,
            "name": "Nome Exemplo",
            "civil_name": "Nome Exemplo",
            "cpf": None,
            "party": "XX",
            "uf": "SP",
            "birth_date": None,
            "sq_candidate": None,
            "ballot_name": None,
            "full_name": "Nome Exemplo",
        }

        graph = expand_ego_network(con, seed, BuildContext())

        self.assertFalse(
            any(link["connectionType"] == "emenda" for link in graph["links"])
        )


if __name__ == "__main__":
    unittest.main()
