# GrafoBR — web

Frontend: Next.js (App Router) + TypeScript + Tailwind v4 + D3 force graph.
Consumes the data contract (`../contract/`) and nothing else. No backend in v1.

## Run

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

`pnpm typecheck` / `pnpm build` before shipping.

> Versions in `package.json` are caret ranges valid at scaffold time. If `pnpm install`
> complains, run `pnpm up --latest` and adjust.

## What's here

```
src/
  app/
    page.tsx                 # demo: fetches /data/sample-ego-network.json → NetworkGraph
    politico/[id]/page.tsx   # STUB — SSG per-politician page (Phase 4)
    layout.tsx, globals.css
  components/
    NetworkGraph.tsx         # STUB — make this a real d3-force graph (Phase 1)
  lib/
    contract.ts              # TS mirror of the data contract (the seam)
    graph-colors.ts          # category/edge color maps (ready to use)
public/
  data/sample-ego-network.json   # synthetic fixture (copy of ../contract sample)
```

## Phase 1 (start here)
Implement `NetworkGraph.tsx` so the synthetic sample renders as an interactive force
graph. The file has detailed d3-force notes at the top. Done when you can drag/zoom the
"Dep. Joana Exemplo" network. No pipeline needed.

## Data flow (real + demo)
The frontend only ever reads **static JSON files**. In the demo it fetches one sample
from `public/data/`. In production, the pipeline emits one file per politician and the
SSG pages load them. The web never queries a database — see `../docs/DECISIONS.md` D1/D6.
