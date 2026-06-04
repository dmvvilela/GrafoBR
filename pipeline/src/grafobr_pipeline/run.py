"""CLI entry point for the static GrafoBR pipeline."""

from __future__ import annotations

import argparse
from pathlib import Path

from .build_ego_networks import BuildContext, build_all


def main() -> int:
    parser = argparse.ArgumentParser(description="Build static GrafoBR ego-networks")
    parser.add_argument("--limit", type=int, default=5, help="number of deputies to emit")
    parser.add_argument(
        "--output-dir",
        default="../data",
        help="directory for generated JSON files",
    )
    parser.add_argument(
        "--cache-dir",
        default=".cache",
        help="directory for downloaded/extracted source files",
    )
    args = parser.parse_args()

    count = build_all(
        BuildContext(
            output_dir=str(Path(args.output_dir)),
            cache_dir=str(Path(args.cache_dir)),
            limit=args.limit,
        )
    )
    print(f"OK — wrote {count} ego-network files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
