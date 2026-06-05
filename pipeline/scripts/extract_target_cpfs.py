"""Dump the CPFs of the currently-built deputies (from data/index.json) using the
local Câmara detail cache, into a target-cpf file for the Receita slicer.

CPFs never leave the build — this file lives only under .cache/. Run with PYTHONPATH=src.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

DEFAULT_CACHE = Path(".cache/camara/deputados")
DEFAULT_INDEX = Path("../data/index.json")
DEFAULT_OUT = Path(".cache/cnpj/target_cpfs.txt")


def _digits(value: object) -> str:
    return "".join(c for c in str(value or "") if c.isdigit())


def extract_target_cpfs(*, index_path: Path, cache_dir: Path, output_path: Path) -> int:
    entries = json.loads(index_path.read_text(encoding="utf-8"))
    cpfs: set[str] = set()
    missing = 0
    for entry in entries:
        detail = cache_dir / f"{entry['id']}.json"
        if not detail.exists():
            missing += 1
            continue
        payload = json.loads(detail.read_text(encoding="utf-8"))
        cpf = _digits(payload.get("dados", {}).get("cpf"))
        if len(cpf) == 11:
            cpfs.add(cpf)
        else:
            missing += 1
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(sorted(cpfs)) + "\n", encoding="utf-8")
    print(f"wrote {len(cpfs)} CPFs -> {output_path} (missing/invalid: {missing})")
    return len(cpfs)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Write private target CPF list from generated data/index.json"
    )
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    extract_target_cpfs(
        index_path=args.index,
        cache_dir=args.cache_dir,
        output_path=args.output,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
