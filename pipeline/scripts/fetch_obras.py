"""Fetch federal infrastructure projects from Obrasgov.br and emit static JSON.

The Obrasgov list endpoints ignore page offsets (every "page" repeats). Discovery
works by querying projeto-investimento per UF + situação, then enriching each
project with execução física/financeira by idUnico.

  cd pipeline && PYTHONPATH=src .venv/bin/python scripts/fetch_obras.py
  cd pipeline && PYTHONPATH=src .venv/bin/python scripts/fetch_obras.py --quick
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path

BASE = "https://api.obrasgov.gestao.gov.br/obrasgov/api"
OUT = Path(__file__).resolve().parents[2] / "data" / "_obras.json"

UFS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]
SITUACOES = ("Paralisada", "Em execução")
FETCH_ERRORS = (
    urllib.error.HTTPError,
    urllib.error.URLError,
    TimeoutError,
    json.JSONDecodeError,
)


def warn(message: str) -> None:
    print(f"  warning: {message}", file=sys.stderr, flush=True)


def _get(path: str, **params: object) -> dict:
    url = f"{BASE}/{path}?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=90) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 502, 503, 504) and attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
        except urllib.error.URLError:
            if attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
    raise RuntimeError(f"failed after retries: {url}")


def discover_projects(max_pages_per_query: int) -> dict[str, dict]:
    """Collect unique projects via UF × situação matrix (API pagination is broken)."""
    found: dict[str, dict] = {}
    queries = [(None, s) for s in SITUACOES] + [(uf, s) for uf in UFS for s in SITUACOES]

    for uf, situacao in queries:
        seen_pages: set[tuple[str, ...]] = set()
        for page in range(max_pages_per_query):
            params: dict[str, object] = {
                "situacao": situacao,
                "page": page,
                "size": 50,
            }
            if uf:
                params["uf"] = uf
            try:
                data = _get("projeto-investimento", **params)
            except FETCH_ERRORS as exc:
                warn(f"skipping {uf or 'BR'}/{situacao} page {page}: {exc}")
                break
            batch = data.get("content") or []
            if not batch:
                break
            key = tuple(p.get("idUnico") for p in batch if p.get("idUnico"))
            if not key or key in seen_pages:
                break
            seen_pages.add(key)
            for project in batch:
                pid = project.get("idUnico")
                if pid:
                    found[pid] = project
        label = f"{uf or 'BR'}/{situacao}"
        print(f"  discover {label}: {len(found)} cumulative", flush=True)
    return found


def fetch_physical(id_unico: str) -> dict | None:
    try:
        data = _get("execucao-fisica", idUnico=id_unico, page=0, size=1)
        content = data.get("content") or []
        return content[0] if content else None
    except FETCH_ERRORS as exc:
        warn(f"physical exec unavailable for {id_unico}: {exc}")
        return None


def fetch_empenhado(id_unico: str) -> float | None:
    total = 0.0
    page = 0
    found = False
    while page < 50:
        try:
            data = _get(
                "execucao-financeira",
                idProjetoInvestimento=id_unico,
                page=page,
                size=50,
            )
        except FETCH_ERRORS as exc:
            warn(f"financial exec unavailable for {id_unico} page {page}: {exc}")
            return total if found else None
        batch = data.get("content") or []
        if not batch:
            break
        found = True
        for row in batch:
            total += float(row.get("valorEmpenho") or 0)
        if data.get("last"):
            break
        page += 1
    return total if found else None


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        y, m, d = map(int, value.split("T")[0].split("-"))
        return date(y, m, d)
    except (TypeError, ValueError):
        return None


def previsto(project: dict) -> float:
    return sum(
        float(fr.get("valorInvestimentoPrevisto") or 0)
        for fr in (project.get("fontesDeRecurso") or [])
    )


def first_value(record: dict, *keys: str) -> object | None:
    for key in keys:
        value = record.get(key)
        if value not in (None, ""):
            return value
    return None


def build_record(
    project: dict,
    physical: dict | None,
    empenhado: float | None,
    today: date,
) -> dict | None:
    pid = project.get("idUnico")
    if not pid:
        return None

    sit = project.get("situacao") or (physical or {}).get("situacao")
    pct = None if physical is None else physical.get("percentual")
    end = parse_date(project.get("dataFinalPrevista"))
    valor_previsto = previsto(project)
    dias_atraso = 0
    if end and sit not in ("Concluída", "Cancelada") and end < today:
        dias_atraso = (today - end).days

    paralisacoes = len((physical or {}).get("cancelamentosParalisacoes") or [])

    signals: list[str] = []
    if sit == "Paralisada" or (physical or {}).get("situacao") == "Paralisada":
        signals.append("paralisada")
    if dias_atraso > 0:
        signals.append("atrasada")
    if pct is not None and pct < 30 and sit not in ("Concluída", "Cancelada"):
        signals.append("baixo_avanco")
    if (
        valor_previsto > 0
        and empenhado is not None
        and empenhado > valor_previsto * 1.1
    ):
        signals.append("empenho_acima_previsto")

    if not signals:
        return None

    ratio = (empenhado / valor_previsto) if valor_previsto and empenhado else None
    executores = [
        ex.get("nome") for ex in (project.get("executores") or []) if ex.get("nome")
    ]
    repassadores = [
        ex.get("nome")
        for ex in (project.get("repassadores") or [])
        if ex.get("nome")
    ]

    motivos: list[str] = []
    if physical:
        for entry in physical.get("cancelamentosParalisacoes") or []:
            if not entry:
                continue
            for m in entry.get("motivosParalisacao") or []:
                if not m:
                    continue
                desc = m.get("descricao")
                if desc and desc not in motivos:
                    motivos.append(desc)

    return {
        "id": pid,
        "nome": (project.get("nome") or "").strip(),
        "uf": project.get("uf"),
        "municipio": first_value(
            project,
            "municipio",
            "nomeMunicipio",
            "municipioBeneficiado",
            "localidade",
        ),
        "codigoMunicipio": first_value(
            project,
            "codigoMunicipio",
            "codMunicipio",
            "ibge",
            "codigoIbge",
        ),
        "situacao": sit,
        "especie": project.get("especie"),
        "natureza": project.get("natureza"),
        "percentualFisico": pct,
        "valorPrevisto": round(valor_previsto, 2) if valor_previsto else None,
        "valorEmpenhado": round(empenhado, 2) if empenhado is not None else None,
        "ratioEmpenhado": round(ratio, 3) if ratio is not None else None,
        "dataFinalPrevista": project.get("dataFinalPrevista"),
        "diasAtraso": dias_atraso,
        "paralisacoes": paralisacoes,
        "motivosParalisacao": motivos[:3] or None,
        "signals": signals,
        "executor": executores[0] if executores else None,
        "repassador": repassadores[0] if repassadores else None,
        "orgao": first_value(project, "orgao", "orgaoResponsavel", "unidadeGestora"),
        "sourceIds": {
            "idUnico": pid,
            "idProjetoInvestimento": first_value(
                project,
                "idProjetoInvestimento",
                "id",
                "codigo",
            ),
        },
    }


def enrich_projects(
    projects: dict[str, dict],
    workers: int,
    with_financial: bool,
) -> list[dict]:
    today = date.today()
    ids = list(projects.keys())
    physical: dict[str, dict | None] = {}
    empenhado: dict[str, float | None] = {}

    print(f"  fetching physical exec for {len(ids)} projects...", flush=True)

    def load_physical(pid: str) -> tuple[str, dict | None]:
        return pid, fetch_physical(pid)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(load_physical, pid) for pid in ids]
        done = 0
        for fut in as_completed(futs):
            pid, row = fut.result()
            physical[pid] = row
            done += 1
            if done % 50 == 0:
                print(f"    physical {done}/{len(ids)}", flush=True)

    if with_financial:
        print(f"  fetching financial exec for {len(ids)} projects...", flush=True)

        def load_fin(pid: str) -> tuple[str, float | None]:
            return pid, fetch_empenhado(pid)

        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = [pool.submit(load_fin, pid) for pid in ids]
            done = 0
            for fut in as_completed(futs):
                pid, val = fut.result()
                empenhado[pid] = val
                done += 1
                if done % 50 == 0:
                    print(f"    financial {done}/{len(ids)}", flush=True)

    records: list[dict] = []
    for pid, project in projects.items():
        rec = build_record(
            project,
            physical.get(pid),
            empenhado.get(pid) if with_financial else None,
            today,
        )
        if rec:
            records.append(rec)
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch Obrasgov projects for GrafoBR")
    parser.add_argument(
        "--quick",
        action="store_true",
        help="1 page per UF query, skip financial exec",
    )
    parser.add_argument(
        "--skip-financial",
        action="store_true",
        help="skip execução financeira (faster)",
    )
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument(
        "--pages-per-query",
        type=int,
        default=1,
        help="max projeto-investimento pages per UF/situação (API repeats after ~2)",
    )
    args = parser.parse_args()
    pages = 1 if args.quick else args.pages_per_query
    with_financial = not args.quick and not args.skip_financial

    print("=== Obrasgov fetch (UF matrix discovery) ===", flush=True)
    projects = discover_projects(max_pages_per_query=pages)
    print(f"discovered {len(projects)} unique projects", flush=True)

    records = enrich_projects(projects, workers=args.workers, with_financial=with_financial)
    records.sort(
        key=lambda r: (
            -(r.get("valorPrevisto") or 0),
            -(r.get("diasAtraso") or 0),
        )
    )

    paralisadas = [r for r in records if "paralisada" in r["signals"]]
    atrasadas = [r for r in records if "atrasada" in r["signals"]]
    atrasadas.sort(key=lambda r: (-(r.get("diasAtraso") or 0), -(r.get("valorPrevisto") or 0)))

    payload = {
        "meta": {
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "source": "obrasgov",
            "sourceUrl": "https://www.gov.br/obrasgov/pt-br/acesso-a-informacao/dados-abertos-obrasgov",
            "disclaimer": (
                "Dados públicos do Obrasgov.br. Situação, prazos e valores refletem "
                "registros oficiais de acompanhamento — não constituem acusação de irregularidade."
            ),
            "discoveryNote": (
                "A API do Obrasgov não pagina listagens de forma confiável; projetos "
                "foram descobertos via consultas por UF e situação (amostra, não inventário completo)."
            ),
            "counts": {
                "discovered": len(projects),
                "flagged": len(records),
                "paralisada": len(paralisadas),
                "atrasada": len(atrasadas),
            },
        },
        "paralisadas": paralisadas,
        "atrasadas": atrasadas[:200],
        "all": records,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} ({len(records)} flagged / {len(projects)} discovered)", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
