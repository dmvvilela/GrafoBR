"""Write + validate one EgoNetwork file against the data contract.

This is the guardrail: the web half can trust the JSON shape because the pipeline
validates every file before writing it. If validation fails, that's a bug to fix here,
not in the frontend.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Union

_CONTRACT_SCHEMA = (
    Path(__file__).resolve().parents[3] / "contract" / "ego-network.schema.json"
)


def _load_schema() -> dict:
    return json.loads(_CONTRACT_SCHEMA.read_text(encoding="utf-8"))


def validate(ego_network: dict) -> None:
    """Validate the JSON shape plus graph invariants the schema cannot express."""
    import jsonschema  # imported lazily so the stub imports without the dep installed

    jsonschema.validate(
        instance=ego_network,
        schema=_load_schema(),
        format_checker=jsonschema.FormatChecker(),
    )

    meta = ego_network["meta"]
    nodes = ego_network["nodes"]
    links = ego_network["links"]
    node_ids = [node["id"] for node in nodes]
    link_ids = [link["id"] for link in links]
    if len(node_ids) != len(set(node_ids)):
        raise ValueError("node ids must be unique within an ego-network")
    if len(link_ids) != len(set(link_ids)):
        raise ValueError("link ids must be unique within an ego-network")

    by_id = {node["id"]: node for node in nodes}
    ego = by_id.get(meta["egoId"])
    if ego is None or ego["category"] != "politician":
        raise ValueError("meta.egoId must identify the politician node")
    if ego["name"] != meta["egoName"]:
        raise ValueError("meta.egoName must match the politician node name")

    degree = {node_id: 0 for node_id in node_ids}
    for link in links:
        if link["source"] not in by_id or link["target"] not in by_id:
            raise ValueError(f"link {link['id']} references a missing node")
        if link["source"] == link["target"]:
            raise ValueError(f"link {link['id']} is a self-loop")
        degree[link["source"]] += 1
        degree[link["target"]] += 1
    for node in nodes:
        if node["connectionCount"] != degree[node["id"]]:
            raise ValueError(f"node {node['id']} has an incorrect connectionCount")

    entity_ids = [node["entityId"] for node in nodes if node.get("entityId")]
    if len(entity_ids) != len(set(entity_ids)):
        raise ValueError("one entityId cannot identify multiple nodes in the same graph")
    if set(meta["sourceCoverage"]) != set(meta["sources"]):
        raise ValueError("sourceCoverage must describe every and only contributing source")


def emit(ego_network: dict, output_dir: Union[str, Path]) -> Path:
    """Validate then write data/<egoId>.json. Returns the path written."""
    validate(ego_network)
    ego_id = ego_network.get("meta", {}).get("egoId")
    if ego_id is None:
        raise ValueError("ego_network.meta.egoId is required to name the file")
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"{ego_id}.json"
    path.write_text(
        json.dumps(ego_network, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return path


if __name__ == "__main__":
    # Smoke test: validate the committed synthetic sample against the schema.
    sample = (
        _CONTRACT_SCHEMA.parent / "sample-ego-network.json"
    )
    data = json.loads(sample.read_text(encoding="utf-8"))
    validate(data)
    print(f"OK — {sample.name} matches the contract "
          f"({len(data['nodes'])} nodes, {len(data['links'])} links)")
