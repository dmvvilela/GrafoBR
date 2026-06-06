"""GrafoBR — build-time AI enrichment (Phase 5): grounded neutral summaries.

Grounded generation with a HUMAN REVIEW GATE (docs/AI-PLAN.md, docs/LEGAL.md):
the model sees only a curated fact list (the same facts as the site's "Destaques"
panel), never the raw graph. Output is validated and written to a REVIEW ARTIFACT
(ai/summaries.json) — it never mutates the public data directly. A separate
`--apply` step bakes only the clean summaries into meta.summary.

  Inspect the exact prompt (system + user), NO model:
    pipeline/.venv/bin/python ai/summarize.py --id 204379 --dry-run

  Generate into the review file (Ollama running):
    pipeline/.venv/bin/python ai/summarize.py --all                # -> ai/summaries.json
  Review ai/summaries.json (flagged entries have non-empty "issues"), then publish:
    pipeline/.venv/bin/python ai/summarize.py --apply              # bakes clean ones
    cd web && node scripts/sync-data.mjs && pnpm build
"""

from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
from pathlib import Path

import httpx

OLLAMA_URL = "http://localhost:11434/api/chat"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
REVIEW_PATH = Path(__file__).resolve().parent / "summaries.json"

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

# Hard guardrail (not just the prompt): a summary containing any of these is rejected.
# NB: not "acusa" — it's a substring of the REQUIRED disclaimer "não são acusações".
FORBIDDEN = [
    "suspeito", "corrupto", "corrupcao", "esquema", "irregular", "irregularidade",
    "desvio", "crime", "criminoso", "propina", "fraude", "ilegal", "lavagem",
    "culpado", "lava jato",
]
MAX_CHARS = 600
MAX_SENTENCES = 5

_PARTY_HINTS = ("partido", "diretorio", "nacional", "estadual", "fundo ", "republicanos")


def _unaccent(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


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
    areas = n_sup = n_donor = 0
    top_area = top_sup = top_donor = top_contract = None
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
            if not any(h in name.lower() for h in _PARTY_HINTS) and (
                not top_donor or v > top_donor[1]
            ):
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


def validate(summary: str, facts: str) -> list[str]:
    """Guardrails beyond the prompt — return a list of issues ([] == clean)."""
    issues: list[str] = []
    s = (summary or "").strip()
    if not facts.strip():
        issues.append("sem fatos para resumir")
    if not s:
        issues.append("resumo vazio")
        return issues
    low = _unaccent(s.lower())
    for term in FORBIDDEN:
        if _unaccent(term) in low:
            issues.append(f"termo proibido: '{term}'")
    if len(s) > MAX_CHARS:
        issues.append(f"muito longo ({len(s)} caracteres)")
    if s.count(".") + s.count("!") > MAX_SENTENCES:
        issues.append("frases demais")
    return issues


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
    return sorted(p for p in DATA_DIR.glob("*.json") if p.stem.isdigit())


def _load_review() -> dict:
    if REVIEW_PATH.exists():
        return json.loads(REVIEW_PATH.read_text(encoding="utf-8"))
    return {}


def apply_reviewed() -> int:
    """Bake clean (issue-free) summaries from the review file into data/<id>.json."""
    review = _load_review()
    if not review:
        raise SystemExit(f"no review file at {REVIEW_PATH} — generate first")
    applied = skipped = 0
    for sid, rec in review.items():
        if rec.get("issues"):
            skipped += 1
            continue
        path = DATA_DIR / f"{sid}.json"
        if not path.exists():
            continue
        ego = json.loads(path.read_text(encoding="utf-8"))
        ego.setdefault("meta", {})["summary"] = rec["summary"]
        path.write_text(json.dumps(ego, ensure_ascii=False, indent=2), encoding="utf-8")
        applied += 1
    print(
        f"applied {applied} summaries, skipped {skipped} flagged. "
        f"Publish: cd web && node scripts/sync-data.mjs && pnpm build"
    )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Grounded summaries (with a review gate)")
    ap.add_argument("--id", help="single ego id -> data/<id>.json")
    ap.add_argument("--all", action="store_true", help="generate for the whole snapshot")
    ap.add_argument("--apply", action="store_true", help="bake clean reviewed summaries into data/")
    ap.add_argument("--model", default="gemma4:12b-mlx")
    ap.add_argument("--force", action="store_true", help="re-generate even if already in the review file")
    ap.add_argument("--dry-run", action="store_true", help="print system+user prompt; no model, no write")
    ap.add_argument("--limit", type=int, default=None, help="cap --all (for testing)")
    args = ap.parse_args()

    if args.apply:
        return apply_reviewed()

    if args.all:
        paths = _ego_files()[: args.limit] if args.limit else _ego_files()
    elif args.id:
        paths = [DATA_DIR / f"{args.id}.json"]
    else:
        raise SystemExit("pass --id <n>, --all, or --apply")

    review = _load_review()
    generated = flagged = skipped = 0
    for i, path in enumerate(paths, 1):
        if not path.exists():
            raise SystemExit(f"not found: {path}")
        ego = json.loads(path.read_text(encoding="utf-8"))
        name = ego.get("meta", {}).get("egoName", path.stem)
        facts = build_facts(ego)

        if args.dry_run:
            sys_msg, user_msg = build_messages(ego)
            print(f"\n=== {name} ===")
            print(f"[system]\n{sys_msg['content']}\n[user]\n{user_msg['content']}")
            continue

        if not facts.strip():  # nothing to ground a summary on
            skipped += 1
            continue
        sid = str(ego.get("meta", {}).get("egoId", path.stem))
        if sid in review and not args.force:
            skipped += 1
            continue

        summary = summarize(ego, args.model)
        issues = validate(summary, facts)
        review[sid] = {"name": name, "summary": summary, "issues": issues}
        generated += 1
        if issues:
            flagged += 1
            print(f"[{i}/{len(paths)}] FLAGGED {name}: {issues} :: {summary}")
        else:
            print(f"[{i}/{len(paths)}] {name}: {summary}")
        time.sleep(0.05)

    if not args.dry_run:
        REVIEW_PATH.write_text(json.dumps(review, ensure_ascii=False, indent=2), encoding="utf-8")
        print(
            f"\n{generated} generated ({flagged} flagged), {skipped} skipped. "
            f"Wrote {REVIEW_PATH.name}.\n"
            f"Review flagged entries, then: ai/summarize.py --apply"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
