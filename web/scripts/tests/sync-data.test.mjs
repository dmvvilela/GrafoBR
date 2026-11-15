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


test("PNCP sync retains per-state first observations when coverage expands", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "grafobr-scope-sync-"));
  try {
    await mkdir(path.join(dir, "web/scripts"), { recursive: true });
    await mkdir(path.join(dir, "web/public/data"), { recursive: true });
    await mkdir(path.join(dir, "data"));
    const script = path.join(dir, "web/scripts/sync-data.mjs");
    await copyFile(new URL("../sync-data.mjs", import.meta.url), script);
    const output = path.join(dir, "web/public/data/_state-contracts.json");
    const input = path.join(dir, "data/_state-contracts.json");
    const snapshot = { fetchedAt: "2026-11-15", history: {
      baselineVersion: "original", sequence: 0, events: [],
      stateBaselines: { SP: { observedAt: "2026-11-13", version: "original" } },
    } };
    await writeFile(output, JSON.stringify(snapshot));
    const expanded = structuredClone(snapshot);
    expanded.history.stateBaselines.DF = { observedAt: "2026-11-15", version: "expanded" };
    await writeFile(input, JSON.stringify(expanded));
    execFileSync(process.execPath, [script], { stdio: "pipe" });
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), expanded);
    for (const stateBaselines of [undefined, { SP: snapshot.history.stateBaselines.SP },
      { ...expanded.history.stateBaselines, DF: { observedAt: "2026-11-16", version: "changed" } }]) {
      await writeFile(input, JSON.stringify({ ...expanded, history: { ...expanded.history, stateBaselines } }));
      assert.throws(() => execFileSync(process.execPath, [script], { stdio: "pipe" }));
      assert.deepEqual(JSON.parse(await readFile(output, "utf8")), expanded);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
