"""GrafoBR — build-time AI enrichment (Phase 5): grounded neutral summaries.

Reads the ego-network JSON the pipeline produced, feeds a local Gemma (via Ollama)
ONLY a curated list of that politician's money facts, and bakes a 2–3 sentence
NEUTRAL Portuguese summary into meta.summary. No live endpoint — every sentence is
reviewable before it ships (see docs/AI-PLAN.md, docs/LEGAL.md).

Verify the prompt WITHOUT a model (no Ollama needed):
    pipeline/.venv/bin/python ai/summarize.py --id 204379 --dry-run

Generate (Ollama running, e.g. `ollama serve` + the model pulled):
    pipeline/.venv/bin/python ai/summarize.py --id 204379            # print one
    pipeline/.venv/bin/python ai/summarize.py --id 204379 --write    # bake it
    pipeline/.venv/bin/python ai/summarize.py --all --write          # whole snapshot
Then re-sync into the site:  cd web && node scripts/sync-data.mjs && pnpm build

What you're learning: grounded generation. The model never sees the raw graph —
only the curated facts — and the system prompt forbids it from adding anything.
That prompt design is the legal safety contract.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

import httpx

OLLAMA_URL = "http://localhost:11434/api/chat"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"

SYSTEM_PROMPT = """\
Você é um assistente de transparência pública. Escreva um resumo NEUTRO e factual,
em português, de 2 a 3 frases, a partir dos dados fornecidos.

Regras estritas:
- Use SOMENTE os números e nomes fornecidos. NÃO invente nada.
- NÃO acuse ninguém de irregularidade, crime ou corrupção.
- NÃO use palavras como "suspeito", "corrupto", "esquema", "irregular", "desvio".
- Descreva apenas o que os registros públicos mostram.
- Deixe implícito que conexões registradas não são acusações.
"""

_PARTY_HINTS = ("partido", "diretorio", "nacional", "estadual", "fundo ", "republicanos")


def _brl(desc: str | None, kw: str | None = None) -> float:
    pat = rf"R\$\s*([\d.]+,\d{{2}})\s*{kw}" if kw else r"R\$\s*([\d.]+,\d{2})"
    m = re.search(pat, desc or "")
    return float(m.group(1).replace(".", "").replace(",", ".")) if m else 0.0


def _money(v: float) -> str:
    if v >= 1e6:
        return f"R$ {v/1e6:.1f} milhões".replace(".", ",")
    if v >= 1e3:
        return f"R$ {v/1e3:.0f} mil"
    return f"R$ {v:.0f}"


def build_facts(ego: dict) -> str:
    """Curated money facts (same basis as the site's 'Destaques' panel)."""
    nodes = {n["id"]: n for n in ego["nodes"]}

    def other(link: dict) -> dict | None:
        s, t = nodes.get(link["source"]), nodes.get(link["target"])
        return t if (s and s.get("category") == "politician") else s

    em_emp = em_pago = ceap = doa = 0.0
    areas = 0
    top_area = top_sup = top_donor = top_contract = None
    n_sup = n_donor = 0
    for link in ego["links"]:
        ct = link["connectionType"]
        node = other(link)
        name = node.get("name", "?") if node else "?"
        desc = link.get("description", "")
        if ct == "emenda":
            e = _brl(desc, "empenhado")
            em_emp += e
            em_pago += _brl(desc, "pago")
            areas += 1
            if not top_area or e > top_area[1]:
                top_area = (name, e)
        elif ct == "despesa":
            v = _brl(desc)
            ceap += v
            n_sup += 1
            if not top_sup or v > top_sup[1]:
                top_sup = (name, v)
        elif ct == "doacao":
            v = _brl(desc)
            doa += v
            n_donor += 1
            is_party = any(h in name.lower() for h in _PARTY_HINTS)
            if not is_party and (not top_donor or v > top_donor[1]):
                top_donor = (name, v)
        elif ct == "contrato":
            v = _brl(desc)
            if not top_contract or v > top_contract[1]:
                top_contract = (name, v)

    lines: list[str] = []
    if em_emp > 0:
        area = f"; área principal: {top_area[0]}" if top_area else ""
        lines.append(
            f"- Emendas individuais (2023+): {_money(em_emp)} empenhado, "
            f"{_money(em_pago)} pago, em {areas} áreas{area}."
        )
    if top_contract:
        lines.append(
            f"- Empresa em que é sócio com contrato federal: {_money(top_contract[1])} "
            f"({top_contract[0]})."
        )
    if ceap > 0:
        sup = f"; maior fornecedor: {top_sup[0]}" if top_sup else ""
        lines.append(
            f"- Despesas da cota parlamentar: {_money(ceap)} a {n_sup} fornecedores{sup}."
        )
    if doa > 0:
        donor = f"; maior privado: {top_donor[0]}" if top_donor else ""
        lines.append(
            f"- Doações de campanha (2022): {_money(doa)} de {n_donor} doadores{donor}."
        )
    return "\n".join(lines)


def build_messages(ego: dict) -> list[dict]:
    ego_name = ego.get("meta", {}).get("egoName", "Parlamentar")
    chamber = ego.get("meta", {}).get("chamber", "camara")
    cargo = "Senador(a)" if chamber == "senado" else "Deputado(a) federal"
    facts = build_facts(ego)
    user = (
        f"{cargo}: {ego_name}\n\n"
        f"REGISTROS PÚBLICOS (use somente estes):\n{facts}\n\n"
        f"Escreva o resumo agora."
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]


def summarize(ego: dict, model: str) -> str:
    payload = {
        "model": model,
        "messages": build_messages(ego),
        "stream": False,
        "options": {"temperature": 0.2},
    }
    resp = httpx.post(OLLAMA_URL, json=payload, timeout=240)
    resp.raise_for_status()
    return resp.json()["message"]["content"].strip()


def _ego_files() -> list[Path]:
    return sorted(
        p for p in DATA_DIR.glob("*.json") if p.stem.isdigit()
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Grounded summaries of ego-networks")
    ap.add_argument("--id", help="single ego id -> data/<id>.json")
    ap.add_argument("--all", action="store_true", help="process the whole snapshot")
    ap.add_argument("--model", default="gemma4:12b-mlx")
    ap.add_argument("--write", action="store_true", help="bake into meta.summary")
    ap.add_argument("--force", action="store_true", help="re-summarize even if present")
    ap.add_argument("--dry-run", action="store_true", help="print the prompt; no model call")
    ap.add_argument("--limit", type=int, default=None, help="cap --all (for testing)")
    args = ap.parse_args()

    if args.all:
        paths = _ego_files()
        if args.limit:
            paths = paths[: args.limit]
    elif args.id:
        paths = [DATA_DIR / f"{args.id}.json"]
    else:
        raise SystemExit("pass --id <n> or --all")

    done = skipped = 0
    for i, path in enumerate(paths, 1):
        if not path.exists():
            raise SystemExit(f"not found: {path}")
        ego = json.loads(path.read_text(encoding="utf-8"))
        name = ego.get("meta", {}).get("egoName", path.stem)

        if args.dry_run:
            msgs = build_messages(ego)
            print(f"\n=== {name} (prompt) ===\n{msgs[1]['content']}")
            continue

        if not args.force and ego.get("meta", {}).get("summary"):
            skipped += 1
            continue
        if not ego.get("links"):
            skipped += 1
            continue

        summary = summarize(ego, args.model)
        print(f"[{i}/{len(paths)}] {name}: {summary}")
        if args.write:
            ego.setdefault("meta", {})["summary"] = summary
            path.write_text(
                json.dumps(ego, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        done += 1
        time.sleep(0.05)

    if not args.dry_run:
        print(f"\ndone: {done} summarized, {skipped} skipped"
              + ("" if args.write else "  (use --write to bake them in)"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
