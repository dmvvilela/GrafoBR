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
PIPELINE_DIR = pathlib.Path(__file__).resolve().parents[1]


def collected(path: pathlib.Path, description: str) -> str:
    if path.exists():
        date = datetime.fromtimestamp(path.stat().st_mtime).strftime("%d/%m/%Y")
        return f"{description}; coleta local em {date}"
    return description


def main() -> None:
    index = json.loads((DATA_DIR / "index.json").read_text(encoding="utf-8"))
    deputies = sum(1 for entry in index if entry.get("chamber") != "senado")
    senators = sum(1 for entry in index if entry.get("chamber") == "senado")
    meta = {
        # local tz (BRT) ISO timestamp; the frontend formats it for display
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "politicians": len(index),
        "deputies": deputies,
        "senators": senators,
        "sourceCoverage": {
            "camara": collected(
                PIPELINE_DIR / ".cache/camara/deputados-page-1.json",
                "parlamentares em exercício na consulta",
            ),
            "senado": collected(
                PIPELINE_DIR / ".cache/senado/senadores_atual.json",
                "parlamentares em exercício na consulta",
            ),
            "tse": "eleições 2022",
            "receita": "snapshot 2023-05",
            "camara_ceap": "ano configurado no build",
            "transparencia": collected(
                PIPELINE_DIR / ".cache/cnpj/scoped/contratos.csv",
                "histórico disponível na consulta",
            ),
            "cgu_emendas": collected(
                PIPELINE_DIR / ".cache/emendas/emendas.csv",
                "emendas individuais de 2023 em diante",
            ),
        },
    }
    out = DATA_DIR / "_meta.json"
    out.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    print(
        f"[write_meta] {out} -> {meta['generatedAt']} "
        f"({deputies} deputies, {senators} senators)"
    )


if __name__ == "__main__":
    main()
