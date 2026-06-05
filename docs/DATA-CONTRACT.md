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
| `name` | string | display name | label |
| `category` | enum | `politician` \| `company` \| `donor` \| `supplier` \| `relative` \| `other` | **node color** |
| `connectionCount` | integer ≥ 0 | node degree (number of edges) | **node size** (scaled 5–24px) |

### link
| field | type | meaning | drives |
|---|---|---|---|
| `id` | integer | edge id | — |
| `source` | integer | node id (D3 `SimulationLinkDatum`) | endpoint |
| `target` | integer | node id | endpoint |
| `connectionType` | enum | `socio` \| `doacao` \| `despesa` \| `contrato` \| `parente` \| `other` | **edge color** |
| `description` | string \| null | human-readable, source-attributed | hover/detail |
| `strength` | number | edge weight | **unused in rendering today** — don't over-invest |

> Note: the Epstein DB stored endpoints as `personId1/personId2`; D3 wants `source/target`.
> We emit `source/target` directly and skip that rename.

## Mapping br-acc / public data → this contract

| Contract field | Comes from | Notes |
|---|---|---|
| node `id` | assigned sequential int | keep CPF/CNPJ→id map **private to the build** |
| node `name` | politician / company / person name | |
| node `category` | which dataset the entity is | politician=Câmara/Senado, company=Receita, donor=TSE, supplier=Câmara CEAP, relative=derived |
| node `connectionCount` | `COUNT(edges)` per node | one DuckDB aggregation |
| link `socio` | Receita **QSA** (quadro de sócios) | politician/relative ↔ company |
| link `doacao` | **TSE** donation records | donor ↔ politician |
| link `despesa` | Câmara **CEAP** quota expenses | politician ↔ supplier |
| link `contrato` | **Portal da Transparência** contracts | company ↔ gov (link to politician via amendments where derivable) |
| link `parente` | **derived** | fuzziest + most legally sensitive — be conservative (LEGAL.md) |
| link `description` | templated from the row | e.g. "Doação de R$50.000 em 2022" |

## The messiness you'll actually hit

The CPF/CNPJ keys make this *far* easier than the Epstein pipeline (which had no IDs and
needed heavy probabilistic dedup). But it's not free:

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

## Validation

`pipeline/` must validate every emitted file against `contract/ego-network.schema.json`
(use `jsonschema` in Python). The web can trust the shape because the pipeline guarantees it.
If you change the contract, change it in **three** places: the schema, the TS mirror, and the
sample fixture — and bump a version note here.
