"""One-time fetch of Receita CNPJ Empresas + Socios zips (skips the huge
Estabelecimentos). Resolves a live release, downloads into .cache/cnpj/.
Idempotent: skips files already present. Run with PYTHONPATH=src.
"""

from __future__ import annotations

from pathlib import Path

import httpx

from grafobr_pipeline.receita import cnpj_zip_names, resolve_cnpj_release

DEST = Path(".cache/cnpj")


def download(url: str, path: Path) -> None:
    if path.exists() and path.stat().st_size > 0:
        print(f"  skip {path.name} (cached, {path.stat().st_size / 1e6:.0f} MB)", flush=True)
        return
    tmp = path.with_suffix(path.suffix + ".tmp")
    done = 0
    with httpx.stream("GET", url, timeout=180, follow_redirects=True) as r:
        r.raise_for_status()
        with tmp.open("wb") as f:
            for chunk in r.iter_bytes(chunk_size=1 << 20):
                f.write(chunk)
                done += len(chunk)
    tmp.replace(path)
    print(f"  ok {path.name} ({done / 1e6:.0f} MB)", flush=True)


def main() -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    release = resolve_cnpj_release()
    print(f"release: {release.mode} {release.base_url}", flush=True)
    names = cnpj_zip_names(("Empresas", "Socios"))
    for i, name in enumerate(names, 1):
        print(f"[{i}/{len(names)}] {name}", flush=True)
        download(release.base_url + name, DEST / name)
    total = sum(p.stat().st_size for p in DEST.glob("*.zip")) / 1e9
    print(f"done — {total:.1f} GB in {DEST}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
