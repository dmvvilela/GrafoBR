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


## President and governors (2026-11-13)

`pipeline/config/executives.json` is the reviewed roster of the president and 27
state/DF governors. Each person has an official evidence URL and review date.
It includes permanent successors and interims, not temporary travel substitutions.
Review all seats when holders change; never reuse a person's ID for a successor.
The loader refuses a roster older than 45 days, a duplicate jurisdiction, or an
ambiguous historical candidate. Incoming election winners are not current holders.

`bash scripts/build_all.sh 513 2026` now includes `--executives` in bootstrap and final
builds. Bootstrap writes only private exact CPF mappings; the Receita slicer includes
those identities. The normal company-root and contract steps then cover the expanded
scope. `python -m grafobr_pipeline.run --executives` also supports explicit builds.
Never append graphs from a separate entity-ID namespace: regenerate the full snapshot.

Historical candidacies are selected from the national TSE 2022 file by reviewed exact
full name, UF, election office and general-election date. The archive also contains
later supplementary elections, which are excluded. Receipt and company joins use
private identifiers. A vice's graph never inherits donations from the ticket's head;
no campaign match remains explicit missing coverage, not zero income.

The historical receipt loader now deduplicates receipt IDs and excludes ALL versions
when amount, donor document or date conflict. The published coverage labels explicitly
state that totals are partial and bound the graph to 25 donors per profile. These
counts must not be represented as complete campaign finances. The separate 2026
financial importer still rejects conflicts and remains candidate-only.

CEAP and individual parliamentary amendments are not assigned to executive profiles.
Company ownership remains a May 2023 snapshot; contracts are federal company records,
not the governor's contracts or state-government spending. Current party is left unset
for these profiles; the historical campaign party has an explicit year.

The November 13 local build validated 622 profiles (513 deputies, 81 senators,
28 executive officeholders) and 24,075 edges. Twenty-three executive profiles have
verified links; five have an explicit empty state (Mailza Assis, Celina Leão, Hana
Ghassan, Lucas Ribeiro, Ricardo Couto). There are 1,173 directed executive-to-other
profile pairs with at least one shared direct entity; this is not a count of unique
undirected pairs. The combined receipt audit consolidated 523 repeated rows and
excluded 149 conflicting receipt identities. The 2026 candidate-only context now
matches 519 profiles; one ambiguous case is still omitted. Its source file remains
October 29, not November 13. Obrasgov retains its prior June 23 snapshot.

## State spending comparisons (2026-11-13)

`/estados` serves a separate, verified snapshot of the 26 states and DF for complete
calendar years 2024 and 2025. All 54 annual records were available on November 13.
The Treasury [DCA API](https://apidatalake.tesouro.gov.br/docs/siconfi/) supplies annual
accounts; the IBGE [SIDRA table 6579](https://sidra.ibge.gov.br/tabela/6579) supplies
July population estimates for the same year. No undocumented population field from
Siconfi is substituted for the explicit IBGE series.

From `pipeline/`:

```sh
PYTHONPATH=src .venv/bin/python -m grafobr_pipeline.state_spending --refresh
```

Without `--refresh`, response caches expire after seven days. Requests are sequential,
at most one per second per Treasury documentation, with bounded retries and verified
pagination. Raw responses, exact URLs and collection dates stay in
`pipeline/.cache/state-spending/`. Failed downloads, inconsistent identity, duplicates,
negative/nonfinite values, and reconciliation errors abort without replacing the last
validated output. Empty official reports produce explicit missing values. The web build
copies `data/_state-spending.json` even when a core pipeline snapshot is absent and
retains the committed file in clean deployments. No job or GitHub Actions schedule is enabled.

Calculation rules:

- Select only **Despesas Liquidadas**; don't mix commitment, liquidation and payment.
- I-E: `Total Geral da Despesa por Função` / `TotalDespesas`. The denominator is
  `Despesas Exceto Intraorçamentárias`. Only two-digit top-level function rows enter
  the breakdown; do not also sum their subfunctions. Their sum must match the total
  to R$1 (rounding tolerance across published cells).
- I-D: reconcile its total with the I-E total plus I-E intra-budget expenditure.
  Investment parent `DO4.4.00.00.00.00` must reconcile to its modality subtotals.
  Sum the `DO4.4.xx.00.00.00` modalities; exclude `DI` intra-budget modalities and
  do not add their detailed child accounts again.
- Per resident = selected expenditure / IBGE population of the same year.
  Share = selected expenditure / total liquidated excluding intra-budget * 100.
  The shares are not constitutional health/education minimum calculations.
- Investments overlap with spending functions and are never stacked with them.
  The composition chart uses health + education + security + remaining functions.
- Values are nominal BRL; trends are not inflation-adjusted. Prior-year arrears are
  not added. Accounts include the state's powers and are not personal gubernatorial
  expenses or the total public expenditure within the territory. DF's special
  competencies and federal financing remain visible when selected.

The page offers source records, exact-value tables, the downloadable snapshot, and
links to current governor profiles with a clear separation from the historical fiscal
period. Shared URLs preserve both UFs, year, metric, unit and data version. A revised
snapshot produces a visible warning; unavailable data cannot produce a numeric card.
PNG cards are rendered locally and include the period, units, source references,
coverage caveats and a reproducible link. Rebuilding the site never restamps the core
`_meta.json` or claims to refresh fiscal sources.

Release validation: 30 pipeline tests and 18 web tests passed; the production build
rendered 2,874 static pages. Edge checks covered 320px and 393px viewports without
horizontal overflow, state/year/category/unit changes, restoring a copied URL after
reload, and PNG preview/download. The exported image was visually inspected, including
investment classification and DF context. Desktop and the local production build were
also checked.

## State contracts and suppliers — SP/MG (PNCP)

This independent pilot covers **publications from 2026-10-01 to 2026-11-12**. It is not a
complete inventory of active contracts. All daily pages of the national PNCP consultation
API are checked, then state-sphere records with contracting unit UF SP/MG are selected.
Only expenditure `tipoContrato.id = 1` and validated PJ suppliers remain. Empenhos,
other instruments, revenue records, subrogated authorities/units, invalid identifiers and
invalid amounts are excluded with reason counts. All state powers are included.
Deduplication/pagination/date inconsistency fails the import; no partial snapshot publishes.
The UI shows initial nominal values, not global/amended value or actual payments.

Official references:
- https://www.gov.br/pncp/pt-br/acesso-a-informacao/dados-abertos
- https://pncp.gov.br/api/consulta/swagger-ui/index.html
- https://pncp.gov.br/manual/pt-br/latest/contrato_empenho/consultar_contrato_ou_empenho.html

Reconstruct the **private** graph identity bridge with the exact core source inputs:

```sh
cd pipeline
PYTHONPATH=src .venv/bin/python -m grafobr_pipeline.run \
  --limit 513 --ceap-year 2026 --senators --executives \
  --cnpj-empresas-csv .cache/cnpj/scoped-executives/receita_empresas_scoped.csv \
  --cnpj-socios-csv .cache/cnpj/scoped-executives/receita_socios_scoped.csv \
  --contratos-csv .cache/cnpj/scoped/contratos.csv \
  --emendas-csv .cache/emendas/emendas.csv \
  --output-dir .cache/pncp/reconstructed \
  --private-identity-path .cache/pncp/graph-identities.json
PYTHONPATH=src .venv/bin/python -m grafobr_pipeline.state_contracts \
  --start 2026-10-01 --end 2026-11-12 --refresh
```

The bridge checks entity-bearing nodes, not nondeterministic order of unrelated amendment
destinations. A mismatch requires rebuilding/reconciling the core snapshot first, never
matching suppliers by display name. The importer uses validated CNPJ roots privately;
`state-supplier-identities.json` must remain in the private cache and be retained across
refreshes for stable URLs. It must never be copied into `data/` or `web/public/`.

Daily raw responses are cached under `.cache/pncp/publications`. `--refresh` refetches the
whole requested period, including historical corrections. Since the history release the
CLI also refetches without this flag; cached pages are only reused within the same attempt. Requests are globally spaced, with shared backoff on HTTP 429. Keep the last public
snapshot if the official source fails. The import writes atomically only after the schema,
coverage and identity checks pass. `pnpm sync-data` copies the resulting sidecar independently.
The core source freshness dates are unchanged by this import. No scheduler was enabled.

Before publishing, run Python and web tests, typecheck, production build, and Edge mobile
QA of the directory, supplier graph, original profile connection, contract/source links,
and downloaded supplier/contract PNG cards. Cards retain period, source and nominal-value
context. Shared URLs carry a snapshot version; older versions display an update notice.

Verified first complete snapshot: `4b926ddae7d60c02` (13 November 2026, São Paulo time).
The importer checked 244,263 national records and 16,898 SP/MG state-sphere records.
Published 3,641 contracts (SP: 2,913; MG: 728), 2,017 suppliers, and 14 matched suppliers
covering 45 PNCP contracts and 355 distinct existing profile graphs. Exclusions:
12,843 other instruments; 27 revenue/unknown-nature records; 331 non-PJ suppliers;
56 subrogated authority/unit records. No document-identity guesswork was used.

PNCP changed the 27 October record count during collection. Inconsistent daily caches
are quarantined under `.cache/pncp/rejected/` and the complete day is retried up to three
times. Persistent inconsistencies fail the import. The final snapshot passed all daily
pagination, uniqueness, schema, identifier and public-graph checks. Historical source
records can still be corrected after collection; this is a dated snapshot, not a live feed.

## Meu estado dashboards — SP and MG

`/meu-estado` links to static `/meu-estado/sp` and `/meu-estado/mg` dashboards.
These views reuse the committed Siconfi/IBGE and PNCP snapshots; this UI release does
not refresh or restamp either source. Annual selectors affect only fiscal charts.
The PNCP publication window remains independently labeled and is never added to
annual expenditure. Supplier shares divide each supplier's initial contract values
by all included contract values for that state only, grouping by existing supplier ID.
Daily counts use publication dates, including zero only on verified covered days.
The six newest records link to the existing contract/source and supplier graph pages.

The server passes only two fiscal states and a bounded contract summary to the client.
Shared URLs preserve year, unit, fiscal version (`sv`) and PNCP version (`cv`); either
source changing triggers a notice. Locally rendered PNG cards contain both periods,
units, sources and the same reproducible URL. No scheduler or pipeline changes.

Validation: 24 web tests and typecheck passed; production build generated 8,536 pages.
Isolated browser checks covered 320px, 393px and desktop: state/year/unit changes,
source-revision notice, bounded supplier totals, supplier graph navigation, PNG rendering,
and copy-link success. Exact-value tables scroll inside their container on narrow phones.
Edge's browser connection was unavailable in this session. Browser URL policy blocked
an automated data-URL PNG download, so only preview rendering and download-link metadata
were verified for this release, not the browser file-save action.

## Contract history and safe PNCP refreshes (November 2026)

The PNCP CLI now always refetches every page of the complete publication window,
including old days, to detect corrections. `--refresh` remains accepted for compatibility.
Keep the window start at `2026-10-01`; extend the end only to a completed day in
`America/Sao_Paulo`. A moving or shrinking window is rejected so it cannot manufacture
removal events. This is a **manual local refresh command**, not a new scheduler;
GitHub Actions schedules remain disabled. A web build never fetches PNCP.

```sh
cd pipeline
PYTHONPATH=src .venv/bin/python -m grafobr_pipeline.state_contracts \
  --start 2026-10-01 --end YYYY-MM-DD --refresh
```

Keep `data/_state-contracts.json` from the latest publication and the private persistent
`.cache/pncp/state-supplier-identities.json` registry. On a fresh checkout the command restores its baseline from the
committed `_state-contracts.json` in `--graph-dir` when the output is absent.
The identity bridge must still match the current profile graphs. Private identity files
must never enter Git or public data. A missing registry fails an existing-history refresh.

`contract_history.py` acquires an OS file lock, marks the attempt, builds a candidate,
validates schema, pagination, identity bridge and coverage, then atomically replaces
**one file containing both snapshot and history**. Errors retain the previous records,
source consultation date, version and history, and only change refresh status to `failed`.
A killed process can leave `running`; the UI explicitly treats that as unconfirmed and
keeps the last completed consultation date. Retrying releases/recovers via the OS lock.
The supplier registry is also written through an atomic private file. The web sync
rejects a missing, older or unrelated history over an existing committed history.

The first snapshot is a baseline, not thousands of new-contract alerts. Later successful
checks append stable events with full sanitized before/after records, observation times,
source versions and changed fields. Unchanged checks advance freshness only. A record
not returning is **not** labeled cancelled. Returning records are new observations in
the recorte, not assertions that the legal contract was newly signed. Historical contract,
supplier and individual change URLs remain available after records leave the current set.
History covers fields of the main contract record; it is not an import of amendment
instruments or payments. Changes before our baseline cannot be reconstructed.

After success, run the pipeline tests, `pnpm --dir web sync-data`, frontend tests,
typecheck and build, review the history diff, then commit/push the public bundle with
its source changes. A failed refresh status becomes public only in a subsequent deployment.
There is no runtime API or unattended deployment added by this feature.

`/acompanhando` saves SP/MG and supplier IDs in versioned browser localStorage. Changes
are counted after following/marking as seen, deduplicated across overlapping follows,
and matched against both sides when a supplier or state changes. Reloads and tabs share
preferences; separate devices do not. Storage failure is shown rather than pretending
the preference was saved. Individual change cards link to immutable observed events;
no recipient, email alert, account or cross-device profile is created.

Release validation: a full fresh recheck completed at `2026-11-14T02:09:43.441451+00:00`. All 43 days / 514 pages and 244,263 national records were checked. The 3,641 scoped contracts and 2,017 suppliers were unchanged from version `4b926ddae7d60c02`, so history correctly retained sequence 0 with no fabricated events. The baseline keeps its original `2026-11-14T00:39:29.061987+00:00` date. Mobile 320/393 px, preference persistence, unfollowing, filters and PNG previews were checked. A clearly labelled local-only fixture verified before/after cards and unread/seen transitions, then was removed before the production build. Automatic file saving was not exercised; PNG previews and download links were verified.
