"""Core build: seed on federal politicians, expand bounded ego-networks with DuckDB,
emit one EgoNetwork per politician.

STUB — the algorithm is described; implement Phase 2 (one source, few politicians)
then Phase 3 (all sources, all ~594, automated). See ../../../docs/PLAN.md.

Why DuckDB: it joins CSV/Parquet in-process with zero server. At ego-network scale the
"graph traversal" is just a few keyed joins — no Neo4j needed (../../../docs/DECISIONS.md D2).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class BuildContext:
    output_dir: str = "../data"
    max_hops: int = 2  # bounded expansion keeps files small + relevant
    max_fanout: int = 200  # cap edges per node to avoid hairballs


# ---------------------------------------------------------------------------
# The algorithm (implement these in order)
# ---------------------------------------------------------------------------


def load_seed_politicians(con) -> list[dict]:
    """Phase 2. Load the ~594 sitting federal deputies + senators from Câmara + Senado.
    Each seed needs a stable identity key (CPF where available) and display name.
    Returns rows like {cpf, name, office, party}.
    """
    raise NotImplementedError


def normalize_keys(con) -> None:
    """Normalize CPF/CNPJ across all loaded tables: strip dots/dashes, restore leading
    zeros, fix encoding. Flag MASKED CPFs (***.XXX.XXX-**) so downstream joins know to
    fall back to fuzzy match instead of exact (see docs/DATA-CONTRACT.md messiness).
    """
    raise NotImplementedError


def expand_ego_network(con, seed: dict, ctx: BuildContext) -> dict:
    """Phase 2–3. For one seed, walk outward up to ctx.max_hops via DuckDB joins:
      - TSE donations         -> doacao edges  (donor -> politician)
      - Receita QSA           -> socio edges   (politician/relative <-> company)
      - Transparência contracts-> contrato edges
    Pull ONLY entities connected to the seed (never the whole Receita base).

    Returns an in-memory graph: {"nodes": [...], "links": [...]} BUT with raw
    CPF/CNPJ identity — the id-assignment + scrubbing happens in `to_contract()`.
    """
    raise NotImplementedError


def to_contract(raw_graph: dict, seed: dict) -> dict:
    """Convert a raw ego-graph into a contract-shaped EgoNetwork:
      - assign sequential integer node `id`s; build a PRIVATE cpf/cnpj -> id map that is
        NOT emitted (privacy/legal — docs/LEGAL.md)
      - set node.category (politician|company|donor|relative|other)
      - compute node.connectionCount = degree
      - set link.source/target to the integer ids, connectionType, templated description
      - fill meta (egoId, egoName, generatedAt, sources, disclaimer); summary stays null
        until Phase 5 build-time AI
    Returns a dict matching contract/ego-network.schema.json.
    """
    raise NotImplementedError


def build_all(ctx: BuildContext | None = None) -> int:
    """Orchestrate: open DuckDB, load sources, normalize, for each seed expand + convert
    + emit (see emit.py). Returns count of files written. Wire this up in run.py.
    """
    raise NotImplementedError
