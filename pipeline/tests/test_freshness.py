import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from grafobr_pipeline.freshness import cache_is_fresh

class FreshnessTests(unittest.TestCase):
    def test_stale_cache_and_forced_refresh(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cache.json"
            self.assertFalse(cache_is_fresh(path))
            path.write_text("{}")
            with patch.dict(os.environ, {"GRAFOBR_REFRESH": "0"}):
                self.assertTrue(cache_is_fresh(path))
                old = time.time() - 8 * 86400
                os.utime(path, (old, old))
                self.assertFalse(cache_is_fresh(path))
            path.write_text("{}")
            with patch.dict(os.environ, {"GRAFOBR_REFRESH": "1"}):
                self.assertFalse(cache_is_fresh(path))
