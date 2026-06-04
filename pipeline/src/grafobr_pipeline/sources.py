"""Data-source registry.

SEED THIS from br-acc's source registry (clone into ../reference/ first — see
../../../reference/README.md). br-acc already mapped the authoritative base URLs and
field meanings across ~39 sources; reimplement clean (AGPL — study, don't copy).

Base URLs below are the well-known public endpoints; VERIFY each against br-acc and the
portal's current docs before relying on it.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Source:
    key: str
    name: str
    base_url: str
    gives: str
    status: str = "todo"  # todo | partial | done
    notes: str = ""


SOURCES: list[Source] = [
    Source(
        key="camara",
        name="Câmara dos Deputados — Dados Abertos",
        base_url="https://dadosabertos.camara.leg.br/api/v2",
        gives="deputies (seed), expenses, amendments (emendas)",
        notes="Clean REST + keyed. Good Phase 2 starting point.",
    ),
    Source(
        key="senado",
        name="Senado Federal — Dados Abertos",
        base_url="https://legis.senado.leg.br/dadosabertos",
        gives="senators (seed)",
    ),
    Source(
        key="tse",
        name="TSE — Dados Abertos",
        base_url="https://dadosabertos.tse.jus.br",
        gives="candidates, campaign donations (doacao edges)",
        notes="Bulk CSVs per election year. Donor CPF/CNPJ keys present.",
    ),
    Source(
        key="receita",
        name="Receita Federal — CNPJ (Dados Abertos)",
        base_url="https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/",
        gives="companies + QSA / quadro de sócios (socio edges)",
        notes="Large bulk dump (~50M cos). Resolve current release with receita.py; "
        "DO NOT ingest whole — pull only entities linked to a seed via the "
        "ego-network expansion.",
    ),
    Source(
        key="transparencia",
        name="Portal da Transparência — API",
        base_url="https://api.portaldatransparencia.gov.br",
        gives="public contracts (contrato edges), sanctions (CEIS/CEPIM)",
        notes="Needs free API key (PORTAL_TRANSPARENCIA_API_KEY). CPFs are MASKED here "
        "(***.XXX.XXX-**) — see docs/DATA-CONTRACT.md messiness.",
    ),
]


def by_key(key: str) -> Source:
    for s in SOURCES:
        if s.key == key:
            return s
    raise KeyError(f"unknown source: {key}")
