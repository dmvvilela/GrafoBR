# GrafoBR — Data Contract (the seam)

This is the **only** interface between the two halves. `pipeline/` produces files in this
shape; `web/` consumes them. They agree on this and nothing else, so each half is built
independently.

- **Machine-readable source of truth:** `contract/ego-network.schema.json` (JSON Schema)
- **Worked example / test fixture:** `contract/sample-ego-network.json` (synthetic)
- **TypeScript mirror:** `web/src/lib/contract.ts`

## The shape

One file per politician (the "ego"):

```jsonc
{
  "meta": {
    "egoId": 1,                       // node id of the politician this file centers on
    "egoName": "Dep. Joana Exemplo",
    "generatedAt": "2026-06-04T00:00:00Z",
    "sources": ["camara", "tse"],     // which portals contributed
    "sourceCoverage": {                 // release/window for each source
      "camara": "consulta atual na data da geração",
      "tse": "eleições 2022"
    },
    "summary": null,                  // optional, filled by build-time AI (Phase 5)
    "disclaimer": "Dados públicos. Conexões não são acusações de irregularidade."
  },
  "nodes": [
    { "id": 1, "name": "Dep. Joana Exemplo",        "category": "politician", "connectionCount": 3 },
    { "id": 2, "name": "Construtora Modelo LTDA",    "category": "company",    "connectionCount": 2 }
  ],
  "links": [
    { "id": 1, "source": 1, "target": 2, "connectionType": "socio",
      "description": "Sócia administradora desde 2019", "strength": 1 }
  ]
}
```

## Field reference

### node
| field | type | meaning | drives |
|---|---|---|---|
| `id` | integer | opaque node id. **Never a CPF/CNPJ.** | edge endpoints |
| `entityId` | string, optional | snapshot-local opaque identity for safe cross-profile joins; never a document hash | shared-entity index |
| `name` | string | display name | label |
| `category` | enum | `politician` \| `company` \| `donor` \| `supplier` \| `destino` \| `relative` \| `other` | **node color** |
| `connectionCount` | integer ≥ 0 | node degree (number of edges) | **node size** (scaled 5–24px) |

### link
| field | type | meaning | drives |
|---|---|---|---|
| `id` | integer | edge id | — |
| `source` | integer | node id (D3 `SimulationLinkDatum`) | endpoint |
| `target` | integer | node id | endpoint |
| `connectionType` | enum | `socio` \| `doacao` \| `despesa` \| `contrato` \| `emenda` \| `parente` \| `other` | **edge color** |
| `description` | string \| null | human-readable, source-attributed | hover/detail |
| `strength` | number | edge weight | **unused in rendering today** — don't over-invest |

Links use integer `source` / `target` node ids (D3 `SimulationLinkDatum`).

## Mapping br-acc / public data → this contract

| Contract field | Comes from | Notes |
|---|---|---|
| node `id` | assigned sequential int | keep CPF/CNPJ→id map **private to the build** |
| node `name` | politician / company / person name | |
| node `category` | which dataset the entity is | politician=Câmara/Senado, company=Receita, donor=TSE, supplier=Câmara CEAP, destino=emenda function (CGU), relative=derived |
| node `connectionCount` | `COUNT(edges)` per node | one DuckDB aggregation |
| link `socio` | Receita **QSA** (quadro de sócios) | politician/relative ↔ company |
| link `doacao` | **TSE** donation records | donor ↔ politician |
| link `despesa` | Câmara **CEAP** quota expenses | politician ↔ supplier |
| link `emenda` | **CGU** individual amendments (emendas individuais) | politician ↔ destino (spending function) |
| link `contrato` | **Portal da Transparência** contracts | company ↔ gov (link to politician via amendments where derivable) |
| link `parente` | **derived** | fuzziest + most legally sensitive — be conservative (LEGAL.md) |
| link `description` | templated from the row | e.g. "Doação de R$50.000 em 2022" |

## The messiness you'll actually hit

Stable CPF/CNPJ keys (kept private in the build) anchor most joins. Still expect mess:

1. **CPF masking (LGPD).** Portal da Transparência publishes CPFs redacted (`***.XXX.XXX-**`).
   Deterministic joins break; fall back to fuzzy match (partial CPF + name + DOB). This is the
   *one* place a Splink-style probabilistic matcher earns its keep. Don't un-mask.
2. **Formatting.** CPF/CNPJ with/without dots-dashes, leading zeros eaten by spreadsheets,
   latin-1 vs utf-8, inconsistent dates. Normalize on ingest.
3. **Schema drift.** Every portal names columns differently. This is the unglamorous
   normalization work br-acc already mapped — read its registry in `reference/`.
4. **Scale asymmetry.** Receita's CNPJ base is ~50M+ companies; >99% irrelevant. The
   ego-network scoping (seed on politicians, expand outward) is what keeps it small — don't
   ingest the whole base, pull only entities connected to a seed.

## Additional static context (September 2026)

The ego-network schema is unchanged. Optional `_elections-2026.json` is a separate,
year-specific sidecar governed by `contract/elections.schema.json`; TS mirrors live in
`web/src/lib/data.ts`. It carries source-generation/import dates, public candidacy fields
and partial receipt totals, never CPF or private join keys. It does not replace 2022 edges.

`_updates.json` records observation batches and `_updates-state.json` stores comparison
state derived only from public graph content. They must be retained together. `_press.json`
contains only reviewed entries from `content/press.json`. See `docs/REFRESH.md` for the
generation commands, semantics, failure behavior and current data-access limitation.

## Validation

`pipeline/` must validate every emitted file against `contract/ego-network.schema.json`
(use `jsonschema` in Python). The web can trust the shape because the pipeline guarantees it.
If you change the contract, change it in **three** places: the schema, the TS mirror, and the
sample fixture — and bump a version note here.


## Executive offices (2026-11-13)

The legacy `meta.chamber` discriminator now accepts `presidencia` and `governo`,
as well as `camara` and `senado`. Executive profiles and index rows carry `office`:
`verifiedAt`, `sourceUrl`, `note`, and nullable `campaignYear`, `campaignOffice`,
`campaignParty`. Office evidence and historical election evidence are separate.
Public IDs >= 1,000,000 are permanently assigned to people in the reviewed roster;
never reassign an ID to the next holder of the same office. CPF and candidate sequences
remain private. All four offices share one opaque entity-ID registry per full build,
so comparisons work across offices without name-only entity matching.

## State spending (2026-11-13)

`_state-spending.json` is an independent static sidecar, governed by
`contract/state-spending.schema.json` and mirrored in `web/src/lib/state-spending.ts`.
It contains 27 UF identities, two complete years (2024/2025), same-year IBGE population,
liquidated expenditure excluding intra-budget transactions, function subtotals and a
separate investment measure. Missing reports/metrics remain null or absent, never zero.
Each annual record carries official API URLs and its actual collection timestamp.
The content-derived `version` excludes collection timestamps; shared links warn after
substantive revisions. This file does not change profile graph identities or core dates.

## State contracts and suppliers (SP/MG pilot)

`contract/state-contracts.schema.json` defines `_state-contracts.json`; TypeScript mirror:
`web/src/lib/state-contracts.ts`. This independent sidecar preserves the core ego seam.
Publication window and source coverage are explicit. Contract amounts are initial nominal
values, not payments or annual DCA spending. Only PNCP instrument 1, expenditure, state
sphere, SP/MG contracting units and validated legal-entity suppliers are included.

Supplier IDs are persistent opaque random IDs from a **private** registry; matrix and
branches share the validated CNPJ root. Private documents never enter public supplier
fields. Official contract URLs contain the public contracting authority's CNPJ.
The private graph bridge is reconstructed from the same core inputs and must match every
public entity-bearing node, including its local and cross-profile IDs. Links retain the
original profile snapshot and node ID. A stale connection fails the web build. New graph
views use actual PNCP agency → contract → supplier paths and copy only documented direct
profile edges; merely holding office never creates an edge to a state supplier.
