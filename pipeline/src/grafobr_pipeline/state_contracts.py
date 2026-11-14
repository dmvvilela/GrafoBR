"""PNCP state contracts: publication-date coverage and verified private identity joins."""

from __future__ import annotations
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
import math
from pathlib import Path
import re
import time
import threading
import uuid
import requests

API = "https://pncp.gov.br/api/consulta/v1/contratos"
UFS = {"SP", "MG"}
_REQUEST_LOCK = threading.Lock()
_NEXT_REQUEST = 0.0


def graph_fingerprint(directory: Path) -> str:
    rows = []
    for path in sorted(directory.glob("*.json")):
        if path.stem.isdigit():
            graph = json.loads(path.read_text())
            rows.append([path.stem, [n for n in graph["nodes"] if n.get("entityId")]])
    return hashlib.sha256(
        json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def clean(value: object) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    text = re.sub(
        r"\b\d{3}[. ]?\d{3}[. ]?\d{3}[- ]?\d{2}\b", "[documento omitido]", text
    )
    return re.sub(
        r"\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b|\b\d{14}\b", "[documento omitido]", text
    )


def valid_cnpj(value: object) -> str | None:
    value = str(value or "").strip()
    if not re.fullmatch(r"(?:\d{14}|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})", value):
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) != 14 or len(set(digits)) == 1:
        return None
    for length, weights in (
        (12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]),
        (13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]),
    ):
        remainder = sum(int(digits[i]) * w for i, w in enumerate(weights)) % 11
        if int(digits[length]) != (0 if remainder < 2 else 11 - remainder):
            return None
    return digits


def fetch_page(day: date, page: int, cache: Path) -> dict:
    path = cache / f"{day.isoformat()}-{page}.json"
    if path.exists():
        return json.loads(path.read_text())
    params = {
        "dataInicial": day.strftime("%Y%m%d"),
        "dataFinal": day.strftime("%Y%m%d"),
        "pagina": page,
        "tamanhoPagina": 500,
    }
    global _NEXT_REQUEST
    for attempt in range(10):
        try:
            # Do not hold the lock while waiting: other workers must be able to
            # extend the shared cooldown immediately after a 429 response.
            while True:
                with _REQUEST_LOCK:
                    delay = _NEXT_REQUEST - time.monotonic()
                    if delay <= 0:
                        _NEXT_REQUEST = time.monotonic() + 3.1
                        break
                time.sleep(min(delay, 1))
            response = requests.get(API, params=params, timeout=90)
            if response.status_code == 429:
                delay = max(60, int(response.headers.get("Retry-After", "60")))
                with _REQUEST_LOCK:
                    _NEXT_REQUEST = max(_NEXT_REQUEST, time.monotonic() + delay)
                print(f"PNCP rate limit: backing off {delay}s", flush=True)
                response.raise_for_status()
            if response.status_code == 204:
                result = {
                    "data": [],
                    "totalRegistros": 0,
                    "totalPaginas": 0,
                    "numeroPagina": page,
                }
            else:
                response.raise_for_status()
                result = response.json()
            if not isinstance(result.get("data"), list):
                raise ValueError("Unexpected PNCP response")
            temporary = path.with_suffix(".tmp")
            temporary.write_text(json.dumps(result, ensure_ascii=False))
            temporary.replace(path)
            return result
        except (requests.RequestException, ValueError):
            if attempt == 9:
                raise
            time.sleep(min(2**attempt, 20))
    raise AssertionError("unreachable")


def collect_day(day: date, cache: Path) -> tuple[list[dict], dict]:
    first = fetch_page(day, 1, cache)
    total, pages = first["totalRegistros"], first["totalPaginas"]
    seen, selected = set(), []
    for page in range(1, max(pages, 1) + 1):
        result = first if page == 1 else fetch_page(day, page, cache)
        if (
            result["totalRegistros"] != total
            or result["totalPaginas"] != pages
            or result["numeroPagina"] != page
        ):
            raise ValueError(
                f"PNCP pagination changed for {day}; clear this date cache and retry"
            )
        for row in result["data"]:
            key = row["numeroControlePNCP"]
            if key in seen:
                raise ValueError(f"Duplicate PNCP row during pagination: {key}")
            seen.add(key)
            if row["dataPublicacaoPncp"][:10] != day.isoformat():
                raise ValueError("PNCP publication date escaped requested window")
            if (
                row.get("orgaoEntidade", {}).get("esferaId") == "E"
                and row.get("unidadeOrgao", {}).get("ufSigla") in UFS
            ):
                selected.append(row)
    if len(seen) != total:
        raise ValueError(f"Incomplete PNCP day {day}: {len(seen)}/{total}")
    print(
        f"{day}: {total} national records checked; {len(selected)} SP/MG state records",
        flush=True,
    )
    return selected, {
        "date": day.isoformat(),
        "nationalRecords": total,
        "pages": pages,
        "stateRecords": len(selected),
    }


def collect_consistent_day(day: date, cache: Path) -> tuple[list[dict], dict]:
    for attempt in range(3):
        try:
            return collect_day(day, cache)
        except ValueError:
            if attempt == 2:
                raise
            rejected = cache.parent / "rejected" / f"{day}-{uuid.uuid4().hex[:8]}"
            rejected.mkdir(parents=True)
            for page in cache.glob(f"{day.isoformat()}-*.json"):
                page.replace(rejected / page.name)
            print(
                f"PNCP changed pagination for {day}; refetching the complete day",
                flush=True,
            )
    raise AssertionError("unreachable")


def normalize(row: dict, registry: dict) -> tuple[dict | None, str]:
    if (
        row.get("orgaoEntidade", {}).get("esferaId") != "E"
        or row.get("unidadeOrgao", {}).get("ufSigla") not in UFS
    ):
        return None, "outsideScope"
    if row.get("orgaoSubRogado") or row.get("unidadeSubRogada"):
        return None, "transferred"
    if row.get("tipoContrato", {}).get("id") != 1:
        return None, "otherInstrument"
    if row.get("receita") is not False:
        return None, "revenueOrUnknown"
    if row.get("tipoPessoa") != "PJ":
        return None, "notCompany"
    cnpj = valid_cnpj(row.get("niFornecedor"))
    if not cnpj:
        return None, "invalidCompanyId"
    try:
        amount = Decimal(str(row.get("valorInicial")))
        if not amount.is_finite() or amount < 0 or not math.isfinite(float(amount)):
            raise InvalidOperation
    except InvalidOperation:
        return None, "invalidAmount"
    root = cnpj[:8]
    supplier_id = registry.setdefault(root, "f" + uuid.uuid4().hex[:20])
    agency = row["orgaoEntidade"]
    agency_cnpj = valid_cnpj(agency.get("cnpj"))
    if not agency_cnpj:
        return None, "invalidAgencyId"
    pncp_id = row["numeroControlePNCP"]
    if not re.fullmatch(r"\d{14}-2-\d{6}/\d{4}", pncp_id):
        raise ValueError("Unexpected PNCP contract identifier")
    contract_id = "c" + hashlib.sha256(pncp_id.encode()).hexdigest()[:20]
    return {
        "id": contract_id,
        "supplierId": supplier_id,
        "supplierName": clean(row["nomeRazaoSocialFornecedor"]),
        "uf": row["unidadeOrgao"]["ufSigla"],
        "agency": clean(agency["razaoSocial"]),
        "unit": clean(row["unidadeOrgao"]["nomeUnidade"]),
        "power": agency["poderId"],
        "number": clean(row["numeroContratoEmpenho"]),
        "year": int(row["anoContrato"]),
        "object": clean(row["objetoContrato"]),
        "initialValue": float(amount),
        "signedAt": row.get("dataAssinatura"),
        "startsAt": row.get("dataVigenciaInicio"),
        "endsAt": row.get("dataVigenciaFim"),
        "publishedAt": row["dataPublicacaoPncp"],
        "updatedAt": row["dataAtualizacao"],
        "sourceUrl": f"https://pncp.gov.br/app/contratos/{agency_cnpj}/{row['anoContrato']}/{row['sequencialContrato']}",
    }, root


def build(args: argparse.Namespace) -> dict:
    cache, public = Path(args.cache_dir), Path(args.graph_dir)
    cache.mkdir(parents=True, exist_ok=True)
    private = json.loads(Path(args.identity_map).read_text())
    if private["graphFingerprint"] != graph_fingerprint(public):
        raise ValueError(
            "Private identity bridge does not match the public graph snapshot. Reconstruct it first."
        )
    start, end = date.fromisoformat(args.start), date.fromisoformat(args.end)
    if start > end or end >= date.today():
        raise ValueError("Use a nonempty publication period ending before today")
    days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    if args.refresh:
        for day in days:
            for cached in cache.glob(f"{day.isoformat()}-*.json"):
                cached.unlink()
    with ThreadPoolExecutor(max_workers=8) as pool:
        batches = list(pool.map(lambda day: collect_consistent_day(day, cache), days))
    registry_path = cache.parent / "state-supplier-identities.json"
    registry = json.loads(registry_path.read_text()) if registry_path.exists() else {}
    contracts, roots, exclusions, seen = [], {}, Counter(), set()
    for rows, _ in batches:
        for row in rows:
            key = row["numeroControlePNCP"]
            if key in seen:
                raise ValueError("Contract repeated across publication dates")
            seen.add(key)
            contract, reason = normalize(row, registry)
            if contract:
                contracts.append(contract)
                roots[contract["supplierId"]] = reason
            else:
                exclusions[reason] += 1
    registry_path.write_text(json.dumps(registry, sort_keys=True))
    registry_path.chmod(0o600)
    entities: dict[str, list] = {}
    for path in sorted(public.glob("*.json")):
        if not path.stem.isdigit():
            continue
        graph = json.loads(path.read_text())
        for node in graph["nodes"]:
            if node.get("entityId"):
                links = [
                    edge
                    for edge in graph["links"]
                    if node["id"] in (edge["source"], edge["target"])
                ]
                entities.setdefault(node["entityId"], []).append(
                    {
                        "profileId": graph["meta"]["egoId"],
                        "profileName": graph["meta"]["egoName"],
                        "nodeId": node["id"],
                        "entityId": node["entityId"],
                        "snapshot": graph["meta"]["generatedAt"],
                        "direct": any(
                            graph["meta"]["egoId"] in (e["source"], e["target"])
                            for e in links
                        ),
                        "relationships": sorted({e["connectionType"] for e in links}),
                    }
                )
    suppliers = []
    for supplier_id, root in sorted(roots.items()):
        records = [c for c in contracts if c["supplierId"] == supplier_id]
        latest = max(records, key=lambda c: c["updatedAt"])
        entity_id = private["companies"].get(root)
        suppliers.append(
            {
                "id": supplier_id,
                "name": latest["supplierName"],
                "aliases": sorted({c["supplierName"] for c in records}),
                "connections": entities.get(entity_id, []) if entity_id else [],
            }
        )
    contracts.sort(key=lambda c: (-c["initialValue"], c["id"]))
    result = {
        "schemaVersion": 1,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "period": {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "basis": "publication",
        },
        "graphFingerprint": private["graphFingerprint"],
        "source": API,
        "coverage": {
            "states": ["SP", "MG"],
            "nationalRecordsChecked": sum(a["nationalRecords"] for _, a in batches),
            "stateRecordsChecked": len(seen),
            "excluded": dict(exclusions),
            "days": [a for _, a in batches],
        },
        "suppliers": suppliers,
        "contracts": contracts,
    }
    result["version"] = hashlib.sha256(
        json.dumps(
            {k: v for k, v in result.items() if k != "fetchedAt"}, sort_keys=True
        ).encode()
    ).hexdigest()[:16]
    from jsonschema import validate

    schema = (
        Path(__file__).resolve().parents[3] / "contract" / "state-contracts.schema.json"
    )
    validate(result, json.loads(schema.read_text()))
    if private["graphFingerprint"] != graph_fingerprint(public):
        raise ValueError(
            "Core identities changed during the PNCP import; no snapshot published"
        )
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    temporary.replace(output)
    print(
        f"Published {len(contracts)} contracts, {len(suppliers)} suppliers, {sum(bool(s['connections']) for s in suppliers)} connected suppliers",
        flush=True,
    )
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Refetch every day in the requested publication period",
    )
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--cache-dir", default=".cache/pncp/publications")
    parser.add_argument("--graph-dir", default="../web/public/data")
    parser.add_argument("--identity-map", default=".cache/pncp/graph-identities.json")
    parser.add_argument("--output", default="../data/_state-contracts.json")
    build(parser.parse_args())


if __name__ == "__main__":
    main()
