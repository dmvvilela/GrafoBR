#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
(cd web && pnpm test && pnpm typecheck && NEXT_PUBLIC_SITE_URL=https://grafo-br.dmvvilela.workers.dev pnpm build)
(cd deploy && pnpm run build && pnpm exec cf deploy --prebuilt --dry-run && pnpm run deploy)
