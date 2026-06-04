# CLAUDE.md — orientation for the implementing model

You're picking up a **scaffold**. Nothing is implemented; the structure, the data
contract, and a detailed plan are in place. Your job is to implement it phase by phase.

## Before you write code, read (in order)
1. `docs/PLAN.md` — the phased build plan. **Start at Phase 1.**
2. `docs/DECISIONS.md` — the reasoning behind every locked choice. These were debated
   at length with the user. **Do not relitigate them** unless the user asks.
3. `docs/DATA-CONTRACT.md` + `contract/` — the JSON seam both halves depend on.
4. `docs/LEGAL.md` — non-negotiable constraints. This project touches living, litigious
   public figures. The framing is "surfaces connections," never "accuses."

## The mental model (so you don't get lost)
- **Two halves, one seam.** `pipeline/` (Python+DuckDB) produces `{nodes,links}` JSON;
  `web/` (Next.js+D3) renders it. They meet only at `contract/ego-network.schema.json`.
- **Everything is static.** No runtime backend in v1. The pipeline runs at build time
  (GitHub Actions), emits files, done.
- **Scope is small on purpose:** ~600 federal politicians, each a bounded "ego-network."
  Not the whole 83M-node graph.

## Locked constraints (from DECISIONS.md — honor these)
- Frontend: **Next.js** (App Router) + **D3/d3-force** + **Tailwind**, package manager **pnpm**.
- Build: **DuckDB** in Python. Output: static JSON. No Neo4j, no live DB in v1.
- AI (later phase): **build-time only**, local **Gemma 4 12B** via Ollama, results baked
  into the JSON. No live AI endpoint in v1 (also a legal safeguard).
- **Never import `br-acc` code into our codebase** (AGPL). Study it in `reference/`,
  reimplement clean. Its value to us = the data-source base URLs + normalization approach.

## Current state
- `web/`: scaffolded, `NetworkGraph.tsx` is a **stub** — Phase 1 is making it real.
- `pipeline/`: stub modules with the algorithm described in comments — Phase 2+.
- `contract/`: **done** — schema + a synthetic sample you can build against immediately.

## First action
Implement `web/src/components/NetworkGraph.tsx` so `pnpm dev` renders the synthetic
`contract/sample-ego-network.json`. That proves the seam end-to-end with zero data work.
See `docs/PLAN.md` → Phase 1.
