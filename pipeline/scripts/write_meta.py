#!/usr/bin/env python3
"""Stamp data freshness into ../data/_meta.json.

Read by the web app to render "Atualizado em ..." in the header so visitors can
tell the static snapshot isn't stale. Run as the FINAL step of build_all.sh, so
the date only moves on a real data rebuild — not on UI-only redeploys.
"""
import json
import pathlib
from datetime import datetime

# build_all.sh runs from pipeline/; output lives at repo-root /data.
DATA_DIR = pathlib.Path(__file__).resolve().parents[2] / "data"


def main() -> None:
    deputies = sum(1 for p in DATA_DIR.glob("*.json") if p.stem.isdigit())
    meta = {
        # local tz (BRT) ISO timestamp; the frontend formats it for display
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "deputies": deputies,
    }
    out = DATA_DIR / "_meta.json"
    out.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    print(f"[write_meta] {out} -> {meta['generatedAt']} ({deputies} deputies)")


if __name__ == "__main__":
    main()
