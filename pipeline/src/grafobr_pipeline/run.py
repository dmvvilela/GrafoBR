"""CLI entry point for the static GrafoBR pipeline."""

from __future__ import annotations

import argparse
from pathlib import Path

from .build_ego_networks import BuildContext, build_all


def main() -> int:
    parser = argparse.ArgumentParser(description="Build static GrafoBR ego-networks")
    parser.add_argument("--limit", type=int, default=5, help="number of deputies to emit")
    parser.add_argument(
        "--output-dir",
        default="../data",
        help="directory for generated JSON files",
    )
    parser.add_argument(
        "--cache-dir",
        default=".cache",
        help="directory for downloaded/extracted source files",
    )
    parser.add_argument(
        "--camara-detail-pool",
        type=int,
        default=None,
        help="number of Câmara deputy detail pages to fetch before matching",
    )
    parser.add_argument(
        "--ceap-year",
        type=int,
        default=None,
        help="optional Câmara CEAP expense year to include as despesa edges",
    )
    parser.add_argument(
        "--cnpj-empresas-csv",
        default=None,
        help="local/scoped Receita Empresas CSV for optional socio edges",
    )
    parser.add_argument(
        "--cnpj-socios-csv",
        default=None,
        help="local/scoped Receita Socios CSV for optional socio edges",
    )
    parser.add_argument(
        "--contratos-csv",
        default=None,
        help="local/scoped Portal da Transparência contracts CSV for optional contrato edges",
    )
    parser.add_argument(
        "--emendas-csv",
        default=None,
        help="BigQuery-derived individual amendments CSV for optional emenda edges",
    )
    parser.add_argument(
        "--senators",
        action="store_true",
        help="also emit current senators (Senado API; emendas-only — no CPF for socio/contrato)",
    )
    args = parser.parse_args()

    count = build_all(
        BuildContext(
            output_dir=str(Path(args.output_dir)),
            cache_dir=str(Path(args.cache_dir)),
            limit=args.limit,
            camara_detail_pool=args.camara_detail_pool,
            ceap_year=args.ceap_year,
            cnpj_empresas_csv=args.cnpj_empresas_csv,
            cnpj_socios_csv=args.cnpj_socios_csv,
            contratos_csv=args.contratos_csv,
            emendas_csv=args.emendas_csv,
            include_senators=args.senators,
        )
    )
    print(f"OK — wrote {count} ego-network files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
