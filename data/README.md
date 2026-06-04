# data/ — generated output

The pipeline writes one `<egoId>.json` per federal politician here (plus an `index.json`
for search/SSG). These are **generated artifacts** and are gitignored — rebuild them with
the pipeline (`../pipeline/`). Don't hand-edit.

In production these are published to a CDN (or committed, if small) and read directly by
the frontend. The web never queries a database — see `../docs/DECISIONS.md` D1.

The canonical synthetic fixture lives in `../contract/sample-ego-network.json` (and a copy
the dev server reads at `../web/public/data/sample-ego-network.json`).
