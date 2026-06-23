# GrafoBR — Decision Log

Every major choice, with the reasoning. These were debated at length with the user.
**Don't relitigate them** unless the user explicitly reopens one. Each entry notes when
it *would* be worth revisiting.

---

### D1 — Precompute to static files, not a live graph server
**Decision:** The pipeline builds `{nodes,links}` JSON at build time; the site serves
static files. No runtime database, no API for the core experience.
**Why:** Brazilian government data is near-static (daily/weekly updates). There's no reason
to query a live DB per request. Precomputing makes hosting ~free (CDN), infinitely scalable
(it's just files), and dodges the heavy infra that bogged down br-acc (Neo4j + terabyte
in-memory + personal hardware).
**Revisit if:** you add a feature that genuinely needs per-request computation (e.g. live
"type any CPF" — which is also out of scope for legal reasons).

### D2 — DuckDB for the build
**Decision:** Use DuckDB (embedded, in-process) for the joins/normalization in the pipeline.
**Why:** No server to run or pay for — it executes in CI or locally and writes static JSON.
At our scale (~594 small ego-networks), bounded expansion is a handful of SQL joins. v1 has
no runtime database; the site reads precomputed files. (If/when a live AI layer ships,
**Neon + pgvector** becomes the RAG store — see D6/Phase 6.)

### D3 — Scope to ~594 federal politicians as bounded ego-networks
**Decision:** Don't build the full 83M-node national graph. Seed on sitting federal deputies
+ senators; expand ~1–2 hops each.
**Why:** Turns an 83M-node / terabyte problem into a few hundred thousand nodes total —
small enough for DuckDB + static JSON + client-side D3, and cheap enough to be free. Federal
elected officials acting in public office are also the *safest legal scope* (see LEGAL.md).
The full "explore anyone" graph is the heavy, risky version; the scoped version covers the
people who actually matter for v1.
**Revisit if:** v1 works and there's appetite (+ legal comfort) to expand to state/municipal.

### D4 — D3 / d3-force for the graph
**Decision:** Render with D3's force simulation in `web/src/components/NetworkGraph.tsx`.
**Why:** The data contract was shaped for D3 from the start — `{id,name,category,connectionCount}`
nodes and `{source,target,connectionType,description,strength}` links. SVG gives crisp labels
and easy CSS; at per-ego scale (~ tens of nodes) performance is fine.

### D5 — Next.js (App Router), not Astro or a plain Vite SPA
**Decision:** Next.js with SSG.
**Why:** Two needs: (a) SEO/shareable per-politician pages — a transparency tool nobody can
Google is half-dead — which rules out a plain client-rendered Vite SPA; (b) **optionality**
for a future serverless endpoint (the eventual live AI feature) "free on Vercel." Astro was
the leaner pick for a *purely* static site and was genuinely close, but the user is fluent in
Next and we know a backend *might* come — Next does SSG **and** API routes, so it spans both
phases with no framework migration. Chosen for low-regret optionality, not because v1 needs a
server.
**Revisit if:** you commit hard to "static forever, no live AI" → Astro would be lighter.

### D6 — AI runs at BUILD time (local Gemma), not at request time — so v1 needs no backend
**Decision:** Any AI (summaries, extraction) runs inside the pipeline on local Gemma 4 12B;
results are baked into the static JSON. No live AI endpoint in v1.
**Why:** Three wins. (1) **No backend** — keeps everything static/free. (2) **Local Gemma is
sufficient** — it only needs to be reachable by you, in your pipeline, not by visitors. (3)
**Legally safer** — every generated sentence is reviewable before it ships, vs a live chatbot
that could fabricate a defamatory claim with no human in the loop. You still learn RAG + agent
orchestration; you just run them as a batch job.
**Note:** Local Gemma **cannot** be deployed on Vercel (no GPU, function limits). A live AI
feature would need a hosted model — that's Phase 6, deferred.
**Revisit if:** a live interactive agent becomes a real goal → Phase 6 + hosted model + Neon.

### D7 — No pnpm workspace / monorepo in v1
**Decision:** Use **pnpm** as the package manager, but **not** a workspace monorepo. `web/` is
a single Next app; `pipeline/` is Python (a JS monorepo can't manage it anyway); the shared
contract lives in language-neutral `contract/` (JSON Schema is the source of truth, TS types
in `web/` mirror it).
**Why:** A workspace adds ceremony (root + nested package.jsons, workspace tooling) for a
project with exactly one JS package. The seam is better expressed as a JSON Schema both
languages reference than as a JS package only TS can import.
**Revisit if:** the JS side grows multiple packages (e.g. a shared UI lib, a JS-based agent
package) → promoting to a pnpm workspace is then trivial.

### D8 — Reference br-acc, never vendor it
**Decision:** Clone br-acc into `reference/` (gitignored) to study its data-source registry,
base URLs, and normalization approach. Reimplement clean. Never import its code into `web/`
or `pipeline/`.
**Why:** br-acc is **AGPL-3.0** (viral copyleft). Vendoring its code would force our shipping
code to AGPL and, for any networked use, to publish source. Its *value to us* is knowledge
(which portals, which fields, how Brazilian gov data is messy) — not its code. Data/facts and
public base URLs aren't copyrightable; the code is. So we learn from it and write our own.
**Revisit if:** never, unless you deliberately choose to adopt AGPL for the whole project.

### D9 — Name: GrafoBR
**Decision:** Project name is **GrafoBR** (chosen by the user over Teia / Lupa / Elo).
**Why:** Descriptive, clear to a developer/OSS audience. Keep all public-facing copy neutral
("connections," "public data") — never bake accusation into naming or UI.
