"""Write + validate one EgoNetwork file against the data contract.

This is the guardrail: the web half can trust the JSON shape because the pipeline
validates every file before writing it. If validation fails, that's a bug to fix here,
not in the frontend.
"""

from __future__ import annotations

import json
from pathlib import Path

_CONTRACT_SCHEMA = (
    Path(__file__).resolve().parents[3] / "contract" / "ego-network.schema.json"
)


def _load_schema() -> dict:
    return json.loads(_CONTRACT_SCHEMA.read_text(encoding="utf-8"))


def validate(ego_network: dict) -> None:
    """Raise jsonschema.ValidationError if the dict doesn't match the contract."""
    import jsonschema  # imported lazily so the stub imports without the dep installed

    jsonschema.validate(instance=ego_network, schema=_load_schema())


def emit(ego_network: dict, output_dir: str | Path) -> Path:
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
