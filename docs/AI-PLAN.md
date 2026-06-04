# GrafoBR — AI Plan (Phase 5: build-time enrichment)

> Local-LLM enrichment that runs **inside the pipeline at build time** and bakes its output
> into the static JSON. **No live AI endpoint in v1** — a deliberate legal safeguard (every
> sentence is reviewable before it ships) that also keeps the app backend-free.
> See `DECISIONS.md` D6 and `LEGAL.md`.

## Why build-time (not a chatbot)
- **No backend** — output is baked into the JSON; the web just displays it.
- **A local model is enough** — it only needs to be reachable by the pipeline, not visitors.
- **Legally safer** — a live chatbot can emit an unreviewed accusatory sentence; build-time
  generation is reviewable.
- **Latency is irrelevant** — it's a batch job over ~594 politicians, so you can run a strong
  model slowly. Quality matters, speed doesn't.
- You still learn RAG + agents — just as a pipeline, not a server.

## Hardware & model (target machine: M5 Max, 36 GB unified)
- **Recommended: Gemma 4 12B at Q8 (~13 GB)** via Ollama (start) or MLX (faster on Apple
  Silicon). On 36 GB this is comfortable *and* leaves room for the embedding model + DuckDB.
  - Q4 (~8 GB) if you want max speed; bf16 (~24 GB) fits but is unnecessary.
  - You *could* run a 27B at Q4 (~16–17 GB), but 12B-Q8 gives near-equal quality at ~2× the
    speed with headroom — the right pick for a batch job. (Your instinct that "12B ≈ 26B" is
    why 12B is the sweet spot here.)
- **256K context** + **native tool use** — both matter for rungs 3–4 below.

## Downloads (trivial on 2 TB)
| Thing | Size | Notes |
|---|---|---|
| Ollama runtime | ~few hundred MB | easiest on-ramp |
| Gemma 4 12B (Q8) | ~13 GB | Q4 ~8 GB for speed |
| `bge-m3` embeddings | ~2 GB | **multilingual — content is PT-BR**, don't use English-only |
| Python libs / DuckDB VSS | <1 GB | `ollama`, `duckdb` |

## Tooling (all free, local)
- **Inference:** Ollama to start → **MLX** for speed on the M5. LM Studio to explore/compare.
- **Embeddings:** `bge-m3` (multilingual, handles Portuguese well).
- **Vector store:** DuckDB **VSS** extension — same engine as the pipeline, so vectors are
  just another build-time artifact. (LanceDB is a fine alternative.)

## What the AI produces (3 tasks, escalating)
1. **Grounded summary (do this first).** Feed one politician's structured facts → a neutral
   PT paragraph into `meta.summary`. It's structured-data→text, so hallucination risk is low
   *if you feed the facts and forbid inventing any*. **Rule:** the model may only restate
   values present in the ego-network.
2. **RAG context blurb (cited).** News/court refs → chunk → embed (`bge-m3`) → DuckDB-VSS
   retrieve → generate a **cited** paragraph. Higher risk (news can defame) → neutral tone,
   citations required, human review before ship.
3. **Investigation agent (tool use).** Give Gemma tools — `query_graph(cpf)`,
   `search_contracts()`, `retrieve_news()` — and let it plan a multi-step gather→reason→draft.
   Gemma 4's native tool use makes this real.

## Where AI does NOT belong (keep this discipline)
CPF/CNPJ joins → SQL. Dedup → Splink. Graph math → algorithms. The LLM is the
natural-language *topping* on a deterministic data spine, never the join engine.

## Integration with the pipeline
- New step `pipeline/.../enrich.py`, run **after** an ego-network is built: read
  `{nodes,links}` + the underlying facts → call Gemma → write `meta.summary` (and later a
  cited `meta.context`). Re-validate against the contract before emit.
- The web displays baked text only. No model at request time.

## Learning track (each rung ships something + answers a recruiter keyword)
| Rung | You build | You learn |
|---|---|---|
| 1 | Run Gemma via Ollama; get JSON / tool-call output | local inference, quantization, structured output |
| 2 | Task 1 — grounded summaries baked into the JSON | **grounding**, prompt templating, anti-hallucination |
| 3 | Task 2 — news → embed → DuckDB-VSS → cited blurb | **RAG** |
| 4 | Task 3 — tool-using investigation agent | **agent orchestration**, tool-calling |
| 5 | Check: did it invent a connection not in the data? | **evals / groundedness** (the differentiator) |

## Legal guardrails (non-negotiable — see LEGAL.md)
- Neutral and factual. **No** "corrupt"/"suspect"/risk-score language.
- Every AI sentence traces to a fact in the data (summary) or a cited source (RAG).
- Build-time + human review gate before publishing. No live generation in v1.

## Getting started (rung 1 — can be done tonight, against the synthetic sample)
You don't need the real pipeline to start rungs 1–2; prototype against
`contract/sample-ego-network.json`.
```bash
# 1. install Ollama from https://ollama.com, then:
ollama pull gemma4:12b          # verify exact tag; or import a Q8 GGUF/MLX from Hugging Face
ollama run gemma4:12b "Responda em uma frase, só com os fatos dados: ..."

# 2. Python side
pip install ollama duckdb
```
```python
# rung 1–2 sketch: grounded summary from the sample
import json, ollama
ego = json.load(open("contract/sample-ego-network.json"))
facts = "\n".join(
    f"{l['connectionType']}: {l['description']}" for l in ego["links"] if l["description"]
)
prompt = (
    "Você é um assistente de transparência. Resuma em 1–2 frases NEUTRAS, usando SOMENTE "
    "os fatos abaixo. Não acuse ninguém. Não invente nada.\n\n" + facts
)
print(ollama.chat(model="gemma4:12b",
                  messages=[{"role": "user", "content": prompt}])["message"]["content"])
```

## Where it plugs into the plan
This is `PLAN.md` Phase 5. Don't wire it into the real build until the pipeline emits real
ego-networks (Phase 2–3) — it needs real facts to summarize. But rungs 1–2 are great to learn
now against the synthetic sample while the pipeline is built.
