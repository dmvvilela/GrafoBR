import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../../src/lib/state-dashboard.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const {
  summarizeStateContracts,
  readDashboardSelection,
  dashboardPath,
  isDashboardSlug,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const snapshot = JSON.parse(
  await readFile(
    new URL("../../public/data/_state-contracts.json", import.meta.url),
    "utf8",
  ),
);
test("state summaries reconcile all contracts, supplier shares and publication days without crossing states", () => {
  for (const uf of ["SP", "MG"]) {
    const result = summarizeStateContracts(snapshot, uf);
    const rows = snapshot.contracts.filter((c) => c.uf === uf);
    assert.equal(result.count, rows.length);
    assert.equal(
      result.supplierCount,
      new Set(rows.map((c) => c.supplierId)).size,
    );
    assert.equal(
      result.total,
      rows.reduce((n, c) => n + c.initialValue, 0),
    );
    assert.equal(
      result.days.reduce((n, d) => n + d.count, 0),
      rows.length,
    );
    assert.equal(result.days.length, 43);
    for (const leader of result.leaders) {
      const value = rows
        .filter((c) => c.supplierId === leader.id)
        .reduce((n, c) => n + c.initialValue, 0);
      assert.equal(leader.value, value);
      assert.equal(leader.share, (value / result.total) * 100);
    }
    assert.ok(result.recent.every((c) => c.uf === uf));
    assert.equal(
      result.recent[0].publishedAt,
      rows
        .map((c) => c.publishedAt)
        .sort()
        .at(-1),
    );
  }
  assert.equal(summarizeStateContracts(snapshot, "RJ"), null);
});
test("supplier grouping uses IDs, preserves zero and has no percentage for an empty denominator", () => {
  const fixture = {
    coverage: { states: ["SP"], days: [{ date: "2026-11-01" }] },
    contracts: [
      {
        id: "a",
        uf: "SP",
        supplierId: "x",
        supplierName: "Same name",
        initialValue: 0,
        publishedAt: "2026-11-01",
        agency: "A",
      },
      {
        id: "b",
        uf: "SP",
        supplierId: "y",
        supplierName: "Same name",
        initialValue: 0,
        publishedAt: "2026-11-01",
        agency: "A",
      },
    ],
    suppliers: [],
  };
  const result = summarizeStateContracts(fixture, "SP");
  assert.equal(result.supplierCount, 2);
  assert.equal(result.total, 0);
  assert.ok(result.leaders.every((s) => s.share === null));
  assert.equal(result.days[0].count, 2);
});
test("dashboard sharing preserves controls and independently detects either revised source", () => {
  const selection = { year: 2024, unit: "share" };
  const params = new URL(
    dashboardPath("mg", selection, "fiscal", "pncp"),
    "https://example.test",
  ).searchParams;
  assert.deepEqual(
    readDashboardSelection(params, [2024, 2025], "fiscal", "pncp"),
    { selection, stale: false, corrected: false },
  );
  assert.equal(
    readDashboardSelection(params, [2024, 2025], "new", "pncp").stale,
    true,
  );
  assert.equal(
    readDashboardSelection(params, [2024, 2025], "fiscal", "new").stale,
    true,
  );
  const invalid = readDashboardSelection(
    new URLSearchParams("year=2026&unit=unknown"),
    [2024, 2025],
    "a",
    "b",
  );
  assert.deepEqual(invalid.selection, { year: 2025, unit: "perCapita" });
  assert.equal(invalid.corrected, true);
  assert.equal(isDashboardSlug("__proto__"), false);
  assert.equal(isDashboardSlug("rj"), false);
});
