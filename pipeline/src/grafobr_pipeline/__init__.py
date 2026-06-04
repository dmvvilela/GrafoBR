"""GrafoBR build-time pipeline.

Downloads public Brazilian data, joins it on CPF/CNPJ with DuckDB, and emits one
{nodes, links} ego-network JSON per federal politician. See ../../README.md and
../../../docs/PLAN.md.
"""

__version__ = "0.0.0"
