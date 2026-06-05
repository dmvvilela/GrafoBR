"""Download just the Empresas + Socios CNPJ shards via the Receita Nextcloud WebDAV
per-file path (the whole-folder download is a 44GB+ streaming dead end). ~2.5GB total
into .cache/cnpj/members/. Idempotent: skips files already present.

Path discovered by inspecting the share tree:
  Publico/Dados/Cadastros/CNPJ/2023-05/{Empresas,Socios}{0-9}.zip
"""

from __future__ import annotations

from pathlib import Path

import httpx

TOKEN = "gn672Ad4CF8N6TK"
RELEASE = "2023-05"
BASE = (
    f"https://arquivos.receitafederal.gov.br/public.php/dav/files/{TOKEN}"
    f"/Dados/Cadastros/CNPJ/{RELEASE}/"
)
DEST = Path(".cache/cnpj/members")
FILES = [f"{t}{i}.zip" for t in ("Empresas", "Socios") for i in range(10)]


def download(url: str, path: Path) -> None:
    if path.exists() and path.stat().st_size > 0:
        print(f"  skip {path.name} ({path.stat().st_size / 1e6:.0f}MB)", flush=True)
        return
    tmp = path.with_suffix(path.suffix + ".tmp")
    with httpx.stream("GET", url, timeout=300, follow_redirects=True) as r:
        r.raise_for_status()
        with tmp.open("wb") as f:
            for chunk in r.iter_bytes(1 << 20):
                f.write(chunk)
    tmp.replace(path)
    print(f"  ok {path.name} ({path.stat().st_size / 1e6:.0f}MB)", flush=True)


def main() -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    for i, fn in enumerate(FILES, 1):
        print(f"[{i}/{len(FILES)}] {fn}", flush=True)
        download(BASE + fn, DEST / fn)
    total = sum(p.stat().st_size for p in DEST.glob("*.zip")) / 1e9
    print(f"done — {total:.1f} GB in {DEST}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
