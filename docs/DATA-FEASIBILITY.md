# GrafoBR — Data Feasibility Assessment

> The pre-build de-risking pass: are br-acc's ETL modules **real** or **stubs**, and what's
> the **minimum source set** for federal-politician ego-networks? Read this before building
> `pipeline/` (Phase 2). Based on reading br-acc's actual module code + its source registry
> (`docs/source_registry_br_v1.csv`) on 2026-06-04.

## Verdict (the "weekend or a quarter" question)

**Not vaporware — the load-bearing extractors are real, production-grade code.** But it's
**not "fork and run" either.** Realistic effort for a v1 (socio + doacao + contrato edges for
the ~594 federal set): **~1–2 focused weeks**, not a weekend, not a quarter. The main time
sink is Receita CNPJ data *volume*, not missing logic.

Three reasons it's real, two reasons it's still work — both matter:

✅ **Real:** every core module reads real data, parses it, and emits records. No
`NotImplementedError`/stubs in our scope. The messy normalization (incl. **masked-CPF
handling**) is already solved — that's the genuinely hard part, and it's done (to study).

⚠️ **Still work:** (1) it's all **file-based** — you must download bulk dumps first;
(2) br-acc loads **one global Neo4j graph**, not ego-networks — our per-politician scoping
and the DuckDB→JSON emit are **new code we write on top.**

## Module-by-module (our scope only)

| Source | Module | Real? | Lines | Reads | Produces (br-acc edge) | → our `connectionType` |
|---|---|---|---|---|---|---|
| TSE donations | `tse.py` | ✅ real | ~280 | `candidatos.csv`, `doacoes.csv` (latin-1) | `DOOU` donor→candidate | **`doacao`** |
| Receita CNPJ/QSA | `cnpj.py` | ✅ real | **~1100** | Receita bulk CSVs | `SOCIO_DE` person→company | **`socio`** |
| Câmara (deputies) | `camara.py` | ✅ real | ~340 | CEAP CSVs | deputies + `GASTOU`/`FORNECEU` (deputy→supplier). **No amendments.** | seed + opt. `contrato` |
| Senado (senators) | `senado.py` | ✅ loaded | — | CEAPS CSVs | senators | seed |
| Transparência | `transparencia.py` | ✅ real | ~280 | `contratos.csv`, `servidores.csv`, `emendas.csv` | `VENCEU` company→contract; `AUTOR_EMENDA` person→amendment | **`contrato`** |
| Tesouro emendas | `tesouro_emendas.py` | ✅ real | ~150 | `emendas_tesouro.csv` | `PAGO_PARA` payment→company. **No author link.** | (steering, defer) |

Registry status counts: **~38 sources `loaded`/`implemented`**, 7 `partial`
(ComprasNet, PNCP, SIOP, SICONFI, Querido Diário, Câmara inquiries, Senado CPIs),
4 `stale`/`blocked_external` (ComprasNet, PNCP, CAGED, DataJud), 70+ `not_built`.
**All five of our core sources are in the `loaded` group.**

## Minimum viable source set (v1)

To draw a federal politician's ego-network you need exactly these five — all real, all loaded:

1. **`camara.py`** — deputies (seed) + supplier edges
2. **`senado.py`** — senators (seed)
3. **`tse.py`** — `doacao` edges (donor → politician)
4. **`cnpj.py`** — `socio` edges (politician/relative ↔ company) ← the heavy one
5. **`transparencia.py`** — `contrato` edges (company won contract) + amendment authorship

Everything else (sanctions, holdings, courts, RAIS, etc.) is **enrichment — skip for v1.**

## What to reuse vs reimplement vs build new

- **Reuse (study, reimplement clean — AGPL):** the *transform/normalization* logic in those
  five modules. This is the valuable, messy part (CPF/CNPJ normalization, encodings, masked-CPF
  fallback, dedup). `cnpj.py` especially — ~1100 lines you do **not** want to rediscover.
- **Replace:** the **load layer.** br-acc calls `loader.load_relationships(... Neo4j MERGE ...)`.
  We swap that for DuckDB joins → emit our `{nodes,links}` contract. Clean seam in their code
  (transform methods are separate from the Neo4j loader).
- **Build new (this is genuinely ours):**
  1. **Ego-network scoping.** br-acc builds the *whole national graph*; we seed on ~594
     politicians and bound the expansion. This is our design, not in br-acc.
  2. **The download/volume pipeline.** All modules read local CSVs; br-acc has
     `etl/scripts/download_*.py`, but Receita CNPJ is tens of GB — plan for it.
  3. The contract emit + schema validation (already stubbed in `pipeline/emit.py`).

## Honest caveats / risks

1. **File-based, not live API.** Mandatory download stage. **Receita CNPJ bulk is the one
   heavy lift** — large, and the reason br-acc needed a big machine. For v1 you can scope the
   CNPJ load to only companies linked to a seed (don't ingest all ~50M).
2. **`parente` edges have NO ready extractor.** None of the loaded modules emit clean family
   ties. Family is *inferred* (shared surname + co-ownership, etc.) — the fuzziest and most
   legally sensitive edge (see `LEGAL.md`). **v1 may ship with no `parente` edges**, and that's
   fine. Don't fake them.
3. **Amendment→contract "steering" is a fuzzy cross-source join.** The author link
   (`transparencia.AUTOR_EMENDA`) and the money link (`tesouro_emendas.PAGO_PARA`) live in
   *different* sources and join on amendment identity (often by name) — error-prone, and the
   most legally loaded inference. **Defer past v1**; show the pieces, don't assert the chain.
4. **Masked CPF is already handled** in `cnpj.py` ("partial/masked documents") — a real gift.
   Study how they do the fuzzy fallback before reinventing it.

## Storage & volume strategy (you do NOT need the full datasets)

> **Updated 2026-06 — as-built.** The whole-folder Receita download is a 44 GB+ truncated dead
> end; use the **per-file WebDAV path** for sócios, and pull **contracts via BigQuery / Base dos
> Dados** (the Transparência portal is AWS-WAF-blocked). The actual working flow + setup is in
> **`pipeline/README.md`**.

The "~1 TB" associated with br-acc is its **RAM** for the whole-nation Neo4j graph — which
we don't build. Our footprint is small by design:

- **Output is tiny:** ~594 ego-networks ≈ **tens of MB** of JSON total.
- **Stream → filter → discard.** DuckDB reads big CSV/Parquet and `SELECT ... WHERE` in the
  seed neighborhood **without loading into RAM** (streams + spills). Write the filtered slice,
  **delete the raw dump.** Peak disk is transient, not cumulative.
- **Receita CNPJ is smaller than it looks for us.** We need only **empresas** (names) +
  **sócios/QSA** (ownership) — *skip the huge `estabelecimentos`/addresses file.* That's
  ~10 GB uncompressed / ~2 GB Parquet, not 90 GB.
- **Default free path (no account): direct download.** Pull Receita's open-data dumps from
  `dadosabertos.rfb.gov.br/CNPJ/` (~6 GB zipped), keep only empresas+sócios. Truly free, no
  signup. Convert to Parquet once (~5–10× smaller) and query from there.
- **Optional optimization: BigQuery.** [Base dos Dados](https://basedosdados.org) hosts CNPJ
  on BigQuery; query just the sócios matching the ~594 seed CPFs → pull a few MB.
  `cnpj.py` already supports the BigQuery-export format. **Caveat:** the free tier (1 TB
  scanned/mo — we'd use a few GB) needs a **Google Cloud account + project**, normally with a
  card on file (cardless "sandbox" mode exists with limits). Not required for v1 — its main
  payoff is the CI cron below, where runners can't hold the local dump.

**Realistic peak disk for a v1 build:** ~20–40 GB fully-local (default), or near-zero via the
optional BigQuery path. Fits a 1 TB Mac trivially — just keep ≥ ~50 GB free during a local run.

**This also unblocks the CI cron (Phase 3):** GitHub Actions runners have only ~14 GB disk,
so they *can't* hold the full Receita dump. The stream/BigQuery approach is what makes the
automated weekly refresh possible — design for it from the start.

## Bottom line for the plan

Phase 2 should start with **`tse.py` (doacao) + `camara.py` (deputies)** — both small, clean,
CSV-keyed — to get a real ego-network for ~5 deputies end-to-end. Add **`cnpj.py` (socio)** in
Phase 3 (budget time for the volume). `transparencia.py (contrato)` after. Skip `parente` and
amendment-steering for v1. The "the hard normalization is already done" assumption **holds** for
our scope — the new work is scoping + swapping Neo4j for DuckDB/JSON + moving the bulk data.
