"""Carve Empresas*.zip + Socios*.zip out of the truncated whole-folder download.

The outer zip's central directory was cut off by the curl timeout, but each member
is STORED (uncompressed) inside it, so we walk the top-level local file headers
sequentially (seeking over each member's bytes) and copy out the ones we need.

  python scripts/salvage_cnpj.py --list      # just map the structure (fast)
  python scripts/salvage_cnpj.py             # extract Empresas*/Socios* -> .cache/cnpj/members
"""

from __future__ import annotations

import argparse
import re
import struct
from pathlib import Path

SRC = Path(".cache/cnpj/_full_release.zip")
OUT = Path(".cache/cnpj/members")
WANT = re.compile(r"(Empresas|Socios)\d+\.zip$")
SIG = b"PK\x03\x04"
U32 = 0xFFFFFFFF


def _real_sizes(comp32, uncomp32, extra):
    """Resolve ZIP64 sizes from the local-header extra field when 0xFFFFFFFF."""
    comp, uncomp = comp32, uncomp32
    if comp32 != U32 and uncomp32 != U32:
        return comp, uncomp
    i = 0
    while i + 4 <= len(extra):
        hid, hsz = struct.unpack("<HH", extra[i : i + 4])
        body = extra[i + 4 : i + 4 + hsz]
        if hid == 0x0001:
            off = 0
            if uncomp32 == U32:
                uncomp = struct.unpack("<Q", body[off : off + 8])[0]
                off += 8
            if comp32 == U32:
                comp = struct.unpack("<Q", body[off : off + 8])[0]
            break
        i += 4 + hsz
    return comp, uncomp


def walk():
    size = SRC.stat().st_size
    with open(SRC, "rb") as f:
        pos = 0
        while True:
            f.seek(pos)
            if f.read(4) != SIG:
                break
            hdr = f.read(26)
            if len(hdr) < 26:
                break
            flags, _method = struct.unpack("<HH", hdr[2:6])
            comp32, uncomp32 = struct.unpack("<II", hdr[14:22])
            fn_len, ex_len = struct.unpack("<HH", hdr[22:26])
            name = f.read(fn_len).decode("latin-1")
            extra = f.read(ex_len)
            comp_size, _uncomp = _real_sizes(comp32, uncomp32, extra)
            data_start = f.tell()
            if flags & 0x08:
                yield name, data_start, None, True  # data descriptor -> size not in header
                return
            truncated = data_start + comp_size > size
            yield name, data_start, comp_size, truncated
            pos = data_start + comp_size
            if pos >= size:
                break


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    if not args.list:
        OUT.mkdir(parents=True, exist_ok=True)

    for name, start, comp_size, truncated in walk():
        flag = " TRUNCATED" if truncated else ""
        mb = f"{comp_size / 1e6:.0f}MB" if comp_size else "?"
        print(f"{name:28s} {mb:>8s}{flag}")
        if args.list or comp_size is None:
            continue
        if WANT.match(name) and not truncated:
            with open(SRC, "rb") as src:
                src.seek(start)
                remaining = comp_size
                with open(OUT / name, "wb") as out:
                    while remaining:
                        chunk = src.read(min(1 << 20, remaining))
                        if not chunk:
                            break
                        out.write(chunk)
                        remaining -= len(chunk)
            print(f"  -> extracted {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
