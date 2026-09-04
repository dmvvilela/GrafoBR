import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  copyFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("standalone election imports sync without rebuilding the committed core; history cannot be overwritten from root data", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "grafobr-sync-"));
  try {
    await mkdir(path.join(dir, "web/scripts"), { recursive: true });
    await mkdir(path.join(dir, "web/public/data"), { recursive: true });
    await mkdir(path.join(dir, "data"));
    const script = path.join(dir, "web/scripts/sync-data.mjs");
    await copyFile(new URL("../sync-data.mjs", import.meta.url), script);
    await writeFile(path.join(dir, "web/public/data/index.json"), '[{"id":7}]');
    await writeFile(
      path.join(dir, "data/_elections-2026.json"),
      '{"year":2026}',
    );
    execFileSync(process.execPath, [script], { stdio: "pipe" });
    assert.equal(
      await readFile(
        path.join(dir, "web/public/data/_elections-2026.json"),
        "utf8",
      ),
      '{"year":2026}',
    );
    assert.equal(
      await readFile(path.join(dir, "web/public/data/index.json"), "utf8"),
      '[{"id":7}]',
    );
    await writeFile(path.join(dir, "data/index.json"), "[]");
    await writeFile(path.join(dir, "data/_updates.json"), '"stale"');
    await writeFile(
      path.join(dir, "web/public/data/_updates.json"),
      '"retained"',
    );
    execFileSync(process.execPath, [script], { stdio: "pipe" });
    assert.equal(
      await readFile(path.join(dir, "web/public/data/_updates.json"), "utf8"),
      '"retained"',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
