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

The local refresh completed successfully on September 4, 2026 at 00:41 BRT: 593
profiles (512 deputies and 81 senators), with CEAP 2026 and fresh Câmara, Senado,
contracts and amendment queries. The resulting static site passed pipeline tests,
frontend data tests, type checking, graph QA and a full production build.

From `pipeline/`, with dependencies and BigQuery credentials configured:

```sh
bash scripts/build_all.sh 512 2026
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
Live 2026 row-level compatibility remains unverified until the blocked official files
are available; tests cover expected columns, privacy, ambiguity and receipt integrity.

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
