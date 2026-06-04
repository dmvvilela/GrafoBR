"""GrafoBR — AI learning track, Steps 1-2: local inference + grounded summary.

Reads a real ego-network JSON (built by the pipeline), feeds ONLY its facts to a
local Gemma via Ollama, and gets back a NEUTRAL Portuguese summary. No accusations,
no invention. This is build-time enrichment — see docs/AI-PLAN.md and docs/LEGAL.md.

Run (Ollama must be running):
    pipeline/.venv/bin/python ai/summarize.py --id 204379
    pipeline/.venv/bin/python ai/summarize.py --id 204379 --write   # bake into meta.summary

What you're learning here:
  Step 1 = call a local model and get text back (the httpx POST to /api/chat).
  Step 2 = GROUNDED generation: we hand the model the facts and forbid it from
           adding anything. That prompt design is what keeps the output legally safe.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import httpx

OLLAMA_URL = "http://localhost:11434/api/chat"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"

# The system prompt is the safety contract. Every rule here maps to docs/LEGAL.md.
SYSTEM_PROMPT = """\
Você é um assistente de transparência pública. Escreva um resumo NEUTRO e factual,
em português, de 2 a 3 frases, sobre as conexões listadas.

Regras estritas:
- Use SOMENTE os fatos fornecidos. NÃO invente nada que não esteja na lista.
- NÃO acuse ninguém de irregularidade, crime ou corrupção.
- NÃO use palavras como "suspeito", "corrupto", "esquema", "irregular", "desvio".
- Descreva apenas o que os dados públicos mostram (quem doou, quanto, quando).
- Termine deixando claro que conexões não são acusações.
"""


def load_ego(arg_id: str | None, arg_file: str | None) -> dict:
    path = Path(arg_file) if arg_file else DATA_DIR / f"{arg_id}.json"
    if not path.exists():
        raise SystemExit(f"not found: {path} (run the pipeline first, or pass --file)")
    return json.loads(path.read_text(encoding="utf-8")), path


def build_facts(ego: dict) -> tuple[str, str, int]:
    """Turn the graph into a plain fact list the model is allowed to use."""
    names = {n["id"]: n["name"] for n in ego["nodes"]}
    ego_name = ego.get("meta", {}).get("egoName", "Político")
    lines, donor_count = [], 0
    for link in ego["links"]:
        src = names.get(link["source"], "?")
        tgt = names.get(link["target"], "?")
        desc = link.get("description") or link["connectionType"]
        lines.append(f"- {src} → {tgt}: {desc}")
        if link["connectionType"] == "doacao":
            donor_count += 1
    return ego_name, "\n".join(lines), donor_count


def summarize(ego: dict, model: str) -> str:
    ego_name, facts, donor_count = build_facts(ego)
    user = (
        f"Político: {ego_name}\n"
        f"Conexões: {len(ego['links'])} (doadores: {donor_count})\n\n"
        f"FATOS (use somente estes — cada linha é um registro público):\n{facts}\n\n"
        f"Escreva o resumo agora."
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "options": {"temperature": 0.2},  # low = stay close to the facts
    }
    resp = httpx.post(OLLAMA_URL, json=payload, timeout=180)
    resp.raise_for_status()
    return resp.json()["message"]["content"].strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Grounded summary of an ego-network")
    parser.add_argument("--id", help="ego id -> data/<id>.json")
    parser.add_argument("--file", help="explicit path to an ego-network json")
    parser.add_argument("--model", default="gemma4:12b-mlx")
    parser.add_argument("--write", action="store_true", help="save into meta.summary")
    args = parser.parse_args()
    if not args.id and not args.file:
        raise SystemExit("pass --id or --file")

    ego, path = load_ego(args.id, args.file)
    summary = summarize(ego, args.model)

    print(f"\n=== {ego.get('meta', {}).get('egoName', path.stem)} ({args.model}) ===\n")
    print(summary, "\n")

    if args.write:
        ego.setdefault("meta", {})["summary"] = summary
        path.write_text(json.dumps(ego, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"written to meta.summary in {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
