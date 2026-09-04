"""Freshness policy for mutable caches; immutable historical archives stay cached."""
import os
import time
from pathlib import Path


def cache_is_fresh(path: Path, max_age_days: int = 7) -> bool:
    if not path.exists() or path.stat().st_size == 0:
        return False
    if os.environ.get("GRAFOBR_REFRESH") == "1":
        return False
    age = time.time() - path.stat().st_mtime
    return 0 <= age < max_age_days * 86400
