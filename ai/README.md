# ai/ — build-time enrichment + learning track

Standalone scripts for the GrafoBR AI layer (`docs/AI-PLAN.md`). **Build-time only:**
they read the pipeline's output and produce neutral, grounded text — no live serving,
no backend. Kept separate from `pipeline/` so it doesn't collide with active pipeline work.

Requires [Ollama](https://ollama.com) running with a Gemma model (and `bge-m3` later for RAG):
```bash
ollama list   # expect: gemma4:12b-mlx, bge-m3
```

## summarize.py — grounded summaries with a review gate
Feeds Gemma ONLY a curated fact list (the same money facts the site's "Destaques"
panel shows), **validates** the output, and writes it to a review artifact
(`ai/summaries.json`). It never mutates the public data directly — a separate
`--apply` step bakes only the clean summaries into `meta.summary`.

```bash
# 1) inspect the exact prompt (system + user), NO model call:
pipeline/.venv/bin/python ai/summarize.py --id 204379 --dry-run

# 2) generate into the review file (Ollama running). Start small:
pipeline/.venv/bin/python ai/summarize.py --all --limit 10
pipeline/.venv/bin/python ai/summarize.py --all            # ~593, resumes if interrupted

# 3) review ai/summaries.json — entries with a non-empty "issues" array are FLAGGED
#    (forbidden term / too long / empty). Fix the prompt or drop them.

# 4) bake the clean ones, then publish:
pipeline/.venv/bin/python ai/summarize.py --apply
cd web && node scripts/sync-data.mjs && pnpm build
```
Guardrails (beyond the prompt): forbidden-term rejection (`corrupto`, `esquema`,
`propina`, …), length/sentence cap, and "no summary if there are no facts".
Flags: `--all`, `--apply`, `--force` (redo), `--dry-run`, `--limit N`.

> **Gotcha:** applied summaries live in `data/<id>.json` → `meta.summary`. A full
> data rebuild (`pipeline/scripts/build_all.sh`) regenerates those files and drops
> the summaries, so run the generate → `--apply` steps **after** a data refresh.
> `ai/summaries.json` is gitignored (intermediate); the applied text ships in the
> committed `web/public/data`.

## Next steps (see docs/AI-PLAN.md)
- Step 3 — RAG: embed news with `bge-m3` → DuckDB VSS → retrieve → cited blurb.
- Step 4 — agent: give Gemma tools (graph/contract/news) and let it plan.
- Step 5 — evals: check the summary only states facts present in the data.
