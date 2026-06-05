"""Extract Empresas/Socios zips from the broad Receita public-share download.

The Receita Nextcloud share can return one very large Zip64 stream for the whole
public folder. `unzip` needs the final central directory, but the useful CNPJ
members can be copied from local file headers once their bytes have arrived.

Run from `pipeline/`:

    python scripts/extract_cnpj_members.py

It is safe to run while the big download is still in progress. Members whose
payload has not fully arrived are reported as pending and left untouched.
"""

from __future__ import annotations

import argparse
import mmap
import re
import struct
import zipfile
from dataclasses import dataclass
from pathlib import Path


DEFAULT_SHARE_ZIP = Path(".cache/cnpj/_full_release.zip")
DEFAULT_OUTPUT_DIR = Path(".cache/cnpj/members")
TARGET_RE = re.compile(
    r"Publico/Dados/Cadastros/CNPJ/(?P<release>[^/]+)/(?P<name>(?:Empresas|Socios)[0-9]\.zip)$"
)
DATA_DESCRIPTOR = b"PK\x07\x08"


@dataclass(frozen=True)
class LocalMember:
    path: str
    release: str
    name: str
    payload_start: int
    payload_end: int | None


def _member_name_at(mm: mmap.mmap, pos: int) -> str | None:
    if pos + 30 > len(mm):
        return None
    name_len = struct.unpack_from("<H", mm, pos + 26)[0]
    extra_len = struct.unpack_from("<H", mm, pos + 28)[0]
    name_start = pos + 30
    name_end = name_start + name_len
    if name_end + extra_len > len(mm):
        return None
    try:
        return mm[name_start:name_end].decode("utf-8")
    except UnicodeDecodeError:
        return None


def _find_next_outer_header(mm: mmap.mmap, start: int) -> int:
    offset = start
    while True:
        pos = mm.find(b"PK\x03\x04", offset)
        if pos == -1:
            return -1
        name = _member_name_at(mm, pos)
        if name and name.startswith("Publico/"):
            return pos
        offset = pos + 4


def _iter_local_members(path: Path) -> list[LocalMember]:
    members: list[LocalMember] = []
    with path.open("rb") as handle:
        with mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            size = len(mm)
            offset = 0
            while True:
                pos = mm.find(b"PK\x03\x04", offset)
                if pos == -1 or pos + 30 > size:
                    break

                name_len = struct.unpack_from("<H", mm, pos + 26)[0]
                extra_len = struct.unpack_from("<H", mm, pos + 28)[0]
                name_start = pos + 30
                name_end = name_start + name_len
                payload_start = name_end + extra_len
                if payload_start > size:
                    break

                member_path = _member_name_at(mm, pos)
                if member_path is None:
                    offset = pos + 4
                    continue

                match = TARGET_RE.match(member_path)
                if match:
                    next_outer = _find_next_outer_header(mm, payload_start)
                    if next_outer == -1:
                        payload_end = None
                    else:
                        descriptor = mm.rfind(DATA_DESCRIPTOR, payload_start, next_outer)
                        payload_end = descriptor if descriptor != -1 else next_outer
                    members.append(
                        LocalMember(
                            path=member_path,
                            release=match.group("release"),
                            name=match.group("name"),
                            payload_start=payload_start,
                            payload_end=payload_end,
                        )
                    )

                offset = pos + 4
    return members


def _copy_slice(src: Path, dst: Path, start: int, end: int) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(dst.suffix + ".tmp")
    remaining = end - start
    with src.open("rb") as source, tmp.open("wb") as target:
        source.seek(start)
        while remaining:
            chunk = source.read(min(8 * 1024 * 1024, remaining))
            if not chunk:
                raise RuntimeError(f"unexpected EOF while extracting {dst.name}")
            target.write(chunk)
            remaining -= len(chunk)
    if not zipfile.is_zipfile(tmp):
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"extracted payload is not a valid zip: {dst}")
    tmp.replace(dst)


def extract_members(
    *,
    share_zip: Path = DEFAULT_SHARE_ZIP,
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    release: str | None = None,
) -> int:
    members = _iter_local_members(share_zip)
    if release:
        members = [member for member in members if member.release == release]
    if not members:
        print("No CNPJ Empresas/Socios members found yet.")
        return 1

    complete = 0
    pending = 0
    for member in members:
        dst = output_dir / member.release / member.name
        if member.payload_end is None:
            pending += 1
            print(f"pending {member.path}")
            continue
        if dst.exists() and dst.stat().st_size > 0:
            print(f"skip {dst} ({dst.stat().st_size / 1e6:.0f} MB)")
            complete += 1
            continue
        _copy_slice(share_zip, dst, member.payload_start, member.payload_end)
        print(f"ok {dst} ({dst.stat().st_size / 1e6:.0f} MB)")
        complete += 1

    print(f"complete: {complete}; pending: {pending}; output: {output_dir}")
    return 0 if complete else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract CNPJ Empresas/Socios zips from a broad Receita share zip"
    )
    parser.add_argument("--share-zip", type=Path, default=DEFAULT_SHARE_ZIP)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--release", help="optional release folder, e.g. 2023-05")
    args = parser.parse_args()

    return extract_members(
        share_zip=args.share_zip,
        output_dir=args.output_dir,
        release=args.release,
    )


if __name__ == "__main__":
    raise SystemExit(main())
