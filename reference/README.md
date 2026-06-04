# reference/ — study material, NOT part of GrafoBR

Clone br-acc here to learn from it. **Nothing in this folder ships.** It's gitignored.

```bash
git clone https://github.com/World-Open-Graph/br-acc reference/br-acc
# (mirror of brunoclz/br-acc — the viral Brazilian public-data graph project)
```

## ⚠️ AGPL boundary — read before you touch it
br-acc is **AGPL-3.0** (viral copyleft). **Do not copy its code** into `web/` or
`pipeline/`. Vendoring it would force our MIT code to AGPL. We take *knowledge*, not code:
facts, public base URLs, and "how Brazilian gov data is messy" aren't copyrightable — the
code is. Reimplement clean. See `../docs/LEGAL.md#agpl-boundary` and `../docs/DECISIONS.md` D8.

## What to actually look at
- **Source registry** (its `docs/` — a CSV/matrix of ~39 sources): the authoritative base
  URLs + field mappings. This is the single most useful thing here → seed
  `pipeline/src/grafobr_pipeline/sources.py` from it.
- **ETL modules** (45 of them): how each portal is fetched + normalized. Use as a checklist
  of what's involved; write our own DuckDB versions.
- **Their gating** (`PUBLIC_ALLOW_PERSON=false`, `PATTERNS_ENABLED=false`, ETHICS/DISCLAIMER
  docs): a map of the legal landmines they already found. Mirror that caution.

## What to ignore
Their Neo4j/FastAPI serving stack — we deliberately don't use it (static precompute
instead; `../docs/DECISIONS.md` D1/D2). Their frontend — we have our own.
