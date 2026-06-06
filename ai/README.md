# ai/ — build-time enrichment + learning track

Standalone scripts for the GrafoBR AI layer (`docs/AI-PLAN.md`). **Build-time only:**
they read the pipeline's output and produce neutral, grounded text — no live serving,
no backend. Kept separate from `pipeline/` so it doesn't collide with active pipeline work.

Requires [Ollama](https://ollama.com) running with a Gemma model (and `bge-m3` later for RAG):
```bash
ollama list   # expect: gemma4:12b-mlx, bge-m3
```

## summarize.py — grounded build-time summaries
Feeds Gemma ONLY a curated fact list (the same key money facts the site's
"Destaques" panel shows) and bakes a neutral PT summary into `meta.summary`.

```bash
# inspect the exact prompt with NO model call (Ollama not needed):
pipeline/.venv/bin/python ai/summarize.py --id 204379 --dry-run
pipeline/.venv/bin/python ai/summarize.py --all --limit 5 --dry-run

# generate (Ollama running). Start small, then the whole snapshot:
pipeline/.venv/bin/python ai/summarize.py --id 204379 --write
pipeline/.venv/bin/python ai/summarize.py --all --write     # ~593, resumes if interrupted

# then publish the summaries into the site:
cd web && node scripts/sync-data.mjs && pnpm build
```
Flags: `--all` (whole snapshot, skips already-summarized), `--force` (redo),
`--dry-run` (prompt only), `--limit N` (cap for testing). The system prompt
enforces `docs/LEGAL.md`: only restate given facts, no accusations, no invention.

> **Gotcha:** summaries live in `data/<id>.json` → `meta.summary`. A full data
> rebuild (`pipeline/scripts/build_all.sh`) regenerates those files and drops the
> summaries, so run `summarize.py` **after** a data refresh, then re-sync.

## Next steps (see docs/AI-PLAN.md)
- Step 3 — RAG: embed news with `bge-m3` → DuckDB VSS → retrieve → cited blurb.
- Step 4 — agent: give Gemma tools (graph/contract/news) and let it plan.
- Step 5 — evals: check the summary only states facts present in the data.
