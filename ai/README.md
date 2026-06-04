# ai/ — build-time enrichment + learning track

Standalone scripts for the GrafoBR AI layer (`docs/AI-PLAN.md`). **Build-time only:**
they read the pipeline's output and produce neutral, grounded text — no live serving,
no backend. Kept separate from `pipeline/` so it doesn't collide with active pipeline work.

Requires [Ollama](https://ollama.com) running with a Gemma model (and `bge-m3` later for RAG):
```bash
ollama list   # expect: gemma4:12b-mlx, bge-m3
```

## summarize.py — Steps 1–2 (local inference + grounded summary)
Feeds ONLY an ego-network's facts to Gemma and gets a neutral PT summary back.
```bash
pipeline/.venv/bin/python ai/summarize.py --id 204379          # print
pipeline/.venv/bin/python ai/summarize.py --id 204379 --write  # bake into meta.summary
```
The system prompt enforces the `docs/LEGAL.md` rules: only restate given facts,
no accusations, no invented content.

## Next steps (see docs/AI-PLAN.md)
- Step 3 — RAG: embed news with `bge-m3` → DuckDB VSS → retrieve → cited blurb.
- Step 4 — agent: give Gemma tools (graph/contract/news) and let it plan.
- Step 5 — evals: check the summary only states facts present in the data.
