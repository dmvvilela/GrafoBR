# GrafoBR — Legal Framing & Constraints

**This is not legal advice.** It's the set of self-imposed constraints that keep the project
defensible. Get a real Brazilian lawyer's review before any public launch. The whole project
is built around these — don't quietly weaken them for a feature.

## The core risk

GrafoBR is about **living, powerful, litigious public figures.** Brazil has:
- **Criminal defamation** (calúnia, injúria, difamação — Código Penal arts. 138–140).
  Publicly implying someone is corrupt can trigger criminal *and* civil action, fast.
- **LGPD** (Lei Geral de Proteção de Dados). Even *public* personal data, when aggregated
  and used to profile individuals, carries obligations and risk.

We are building a navigable view of every sitting federal congressman from public records —
which is exactly why br-acc gated person data (`PUBLIC_ALLOW_PERSON=false`), disabled its
pattern engine (`PATTERNS_ENABLED=false`), and shipped ETHICS/DISCLAIMER docs. We mirror
that caution by design.

## Constraints baked into the architecture

1. **Connections, not accusations.** We surface *that* a connection exists in public data and
   *where it came from*. We do **not** label anyone "corrupt," "suspect," or attach a "risk
   score" in v1. UI/copy/naming stays neutral. (This was also br-acc's own pivot.)

2. **Scope = elected federal officials acting in public office.** The most defensible subjects:
   deputies/senators, and their *public* activities (donations received, contracts, company
   ownership on public record). Avoid private individuals who aren't public figures.

3. **CPF never ships.** Node `id` is an opaque integer. The CPF↔id map stays inside the build
   and is never published. This aligns with LGPD data-minimization *and* with the reality that
   Portal da Transparência already **masks** CPFs (`***.XXX.XXX-**`) — we don't un-mask them.

4. **Source attribution on everything.** Every edge carries a human-readable `description` and
   should trace to a public source. Every page shows which portals the data came from. "Here's
   the public record; draw your own conclusion" is the posture.

5. **Build-time AI only (v1).** Any LLM-generated text is produced in the pipeline and is
   **reviewable before it ships** — never generated live per visitor. A live chatbot that can
   emit an unreviewed accusatory sentence is a lawsuit generator. (See `DECISIONS.md` D6.)

6. **Visible disclaimers.** Every politician page states: data is public-by-law, connections
   are not allegations of wrongdoing, errors can be reported. Provide a correction channel.

7. **Conservative on derived/fuzzy data.** `parente` (family) edges and amendment→contract
   links are *inferred*, not stated by a clean public dataset. Inference is the most error-prone
   *and* most legally sensitive part. Show the underlying chain; don't assert intent.

## <a name="agpl-boundary"></a>AGPL boundary (br-acc)

`br-acc` is **AGPL-3.0**. We **study** it in `reference/` (gitignored) and **reimplement**.
We never copy its source into `web/` or `pipeline/`. Why it matters: AGPL is viral — vendoring
it would force our code to AGPL and, for networked use, to publish source. What we take is
*knowledge* (which portals, base URLs, how the data is messy) — facts and public URLs aren't
copyrightable. Our own code stays MIT.

## What "defensible v1" looks like
Public official → public data → shown as attributed connections → neutral framing → visible
disclaimers → no scores, no accusations, no un-masked CPFs, no unreviewed AI text. That's the
bar. A feature that breaks any of these needs a deliberate, lawyer-reviewed decision — not a
quiet code change.
