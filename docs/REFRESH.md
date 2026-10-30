# Refresh, election context and updates

## Execution and hosting

GitHub Actions scheduling stays disabled: the account's Actions minutes were exhausted.
Cloudflare was inspected on September 4, 2026 using the authenticated Wrangler account:
six Workers, three Pages projects, and no deployed Workflows. Only `chutometro-cron`
and `pharos-cron` have cron triggers; their deployed code does not reference GrafoBR or
GitHub Actions. No GrafoBR refresh job was found in that account. Other accounts were
not inspected. This explains the earlier uncertainty without treating the user's
recollection as proof of a GrafoBR scheduler.
This change does not deploy, schedule a job, or enable an Actions workflow.

The full pipeline still needs Python/DuckDB, persistent disk for Receita shards, and
BigQuery credentials. The commands below run locally without consuming Actions minutes.
The web build consumes static outputs; it does not fetch government datasets or invoke
the pipeline. A site rebuild by itself is not a source refresh.

## Core records

The latest local core refresh completed on October 29, 2026 at 14:12 BRT: **594
profiles (513 deputies and 81 senators)**, with CEAP 2026 and fresh Câmara, Senado,
contracts and amendment queries. The current Câmara list was checked against the
output; the former 512 limit omitted one current deputy. Recheck the list size
before each refresh. This is a local snapshot, not confirmation of deployment.

From `pipeline/`, with dependencies and BigQuery credentials configured:

```sh
bash scripts/build_all.sh 513 2026
```

The final argument selects the CEAP year explicitly (the legacy default is 2025).
Câmara list/details, CEAP and Senado caches now expire after seven days. To force those
queries sooner, prefix the command with `GRAFOBR_REFRESH=1`. Network errors abort instead
of falling back silently to expired data. Large historical 2022 election and May 2023
Receita archives remain cached; refreshing does **not** turn those into current data.
Contracts/emendas are re-queried through the existing BigQuery steps. Obrasgov is a
separate source/run (`scripts/fetch_obras.py`), as documented in `pipeline/README.md`.

`_meta.json.generatedAt` records a data build. `sourceCoverage` records each source's
reference period and known local collection date. CEAP now includes the actual configured
year and archive collection date. Never restamp `_meta.json` during a UI-only deployment.

## 2026 election context

### October 29–30 refresh result

The official candidate and receipt ZIPs became downloadable on October 29.
The candidate file (source generation October 29, 12:30:44 BRT) was imported
against all 594 profiles: **499 exact matches; one ambiguous profile excluded**.
The receipts archive uses `AA_ELEICAO`, now normalized to `ANO_ELEICAO` with
conflicting aliases rejected. Importing the actual receipts then found conflicting
values for the same candidate/receipt key and correctly aborted. The candidate-only
snapshot leaves financial totals null and `financeImported: false`; do not sum
revisions or infer zero revenue. Resolve receipt revision semantics before importing
the finance archive.

Reproduce the candidate-only import from the downloaded cache:

```sh
PYTHONPATH=src .venv/bin/python -m grafobr_pipeline.elections \
  --candidates .cache/elections/consulta_cand_2026.zip --index ../data/index.json
```

Obrasgov was fetched separately into `.cache/obras-refresh.json` for inspection.
Repeated HTTP 500 and 429 failures left discovery and physical enrichment incomplete
(461 discovered, 357 flagged). **That file was not promoted.** The published-data
folder retains the June 23 Obrasgov snapshot and its original date. Retry when the
source is healthy; never replace it with an incomplete response stamped as current.

### Import workflow and earlier source availability

Official sources (verified September 2026):

- [Candidates](https://dadosabertos.tse.jus.br/dataset/candidatos-2026)
- [Campaign accounts](https://dadosabertos.tse.jus.br/dataset/prestacao-de-contas-eleitorais-2026)

From `pipeline/`:

```sh
PYTHONPATH=src .venv/bin/python -m grafobr_pipeline.elections --download --download-receipts
```

The TSE portal and candidate resource page were reachable in a browser on September 4,
2026, but the CDN still returned HTTP 403 to the importer. If the official
files can be downloaded in a browser, import them locally instead:

```sh
PYTHONPATH=src .venv/bin/python -m grafobr_pipeline.elections \
  --candidates /absolute/path/consulta_cand_2026.zip \
  --receipts /absolute/path/prestacao_de_contas_eleitorais_candidatos_2026.zip
```

Receipts are optional. Extracted national CSVs are also accepted (Latin-1, semicolon).
The importer selects the national member only; it never sums national and UF copies.
The current `web/public/data/index.json` defines the public profile scope by default;
pass `--index ../data/index.json` after a new core build, before syncing.
Matching uses exact unmasked identifiers from the private Câmara detail cache, omitting
ambiguous cases. Senators are not automatically matched by name. No CPF, donor document,
or TSE private join key is emitted. The importer does not change 2022 graph edges.

The result is `data/_elections-2026.json`, validated against
`contract/elections.schema.json`, then atomically replaced. Download, schema, wrong-year,
empty-file and conflicting-receipt failures preserve the existing published output.
Missing matching receipts produce **null**, not a claim of zero revenue. Receipt amounts
use decimal arithmetic before export; duplicate receipt IDs are not counted twice.
Source generation time (from TSE rows) and local import time remain separate.
Candidate row-level compatibility was verified with the October 29 official file.
Receipt revision conflicts remain unresolved; tests cover year-column aliases,
privacy, ambiguity and receipt integrity.

## Build and review

From `web/`:

```sh
pnpm sync-data
pnpm test
pnpm typecheck
pnpm build
```

`/eleicoes` separates 2026 context from 2022 graph navigation. Without an imported 2026
file it displays an explicit unavailable state with official TSE links, never invented
candidatures or amounts. Profile pages show the same context.

`/atualizacoes` compares all profiles' relation groups and Obrasgov records, plus imported
2026 context. Graph comparison ignores generated node/entity IDs and uses sorted public
edge content. The first run establishes a baseline, not a list of new real-world events.
Later changes have an **observation date**, not an inferred event date. Source coverage
changes, removal from the sample, and corrections can also change these records.

Keep `web/public/data/_updates.json` **and** `_updates-state.json` together in the data
snapshot. They retain up to 30 comparisons; unchanged data does not erase history or
advance its date. Losing either file is a build error. Starting with neither establishes
a new baseline. Do not run concurrent generators against the same output directory.
The state contains only public profile/work metadata and hashes of public graph content.
The old `_signals.json` / `_changes.json` summary also survives unchanged rebuilds.

`content/press.json` supplies reviewed “Na imprensa” links. See `content/README.md` for
the editorial format. The build excludes drafts and validates reviewed URLs, dates and
profile associations. No articles have been seeded or automatically attributed.

All commands above prepare local static artifacts. Review the diff, including generated
data, before publishing through the existing deployment path.

## Visual comparison and sharing

`/comparar` joins direct profile connections by the pipeline's opaque `entityId`,
never display names. Suggested pairs are verified against the actual profile files.
Indirect company contracts are not rendered as direct politician-to-entity edges.
The selected entity's two source records and coverage periods remain visible.

Copied URLs carry both profile IDs, the selected entity and both profile generation
timestamps. Entity IDs are snapshot-local: a link from another generation warns and
requires a fresh selection instead of silently selecting a recycled ID. PNG cards
are generated locally in the browser with the selected entity, source periods,
profile dates and neutral context. Their printed URL opens the pair; copy the full
link alongside the image to preserve the exact selected connection.
