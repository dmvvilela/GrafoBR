import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../../src/lib/federal-contracts.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const {
  filterFederalContracts,
  summarizeFederalContracts,
  assertFederalSnapshot,
  federalHistoryBatches,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const federal = JSON.parse(
  await readFile(
    new URL("../../public/data/_federal-contracts.json", import.meta.url),
    "utf8",
  ),
);
const state = JSON.parse(
  await readFile(
    new URL("../../public/data/_state-contracts.json", import.meta.url),
    "utf8",
  ),
);
const filters = { uf: "", power: "", org: "", q: "", sort: "value" };
test("federal and state snapshots are disjoint; federal DF never enters district totals", () => {
  assertFederalSnapshot(federal);
  const stateIds = new Set(state.contracts.map((c) => c.id));
  assert.ok(federal.contracts.every((c) => !stateIds.has(c.id)));
  const df = filterFederalContracts(federal.contracts, {
    ...filters,
    uf: "DF",
  });
  assert.ok(df.length > 0);
  assert.ok(df.every((c) => c.sphere === "F" && c.uf === "DF"));
  assert.equal(
    summarizeFederalContracts([...df, ...state.contracts]).count,
    df.length,
  );
  assert.throws(() =>
    assertFederalSnapshot({
      ...federal,
      contracts: [...federal.contracts, ...state.contracts],
    }),
  );
});
test("national and filtered totals reconcile with the federal records, suppliers and agencies", () => {
  for (const uf of ["", ...new Set(federal.contracts.map((c) => c.uf))]) {
    const rows = filterFederalContracts(federal.contracts, { ...filters, uf });
    const summary = summarizeFederalContracts(rows);
    assert.equal(summary.count, rows.length);
    assert.equal(
      summary.total,
      rows.reduce((n, c) => n + c.initialValue, 0),
    );
    assert.equal(
      summary.supplierCount,
      new Set(rows.map((c) => c.supplierId)).size,
    );
    assert.equal(
      summary.agencyCount,
      new Set(rows.map((c) => c.agencyId)).size,
    );
    for (const leader of summary.agencies)
      assert.equal(
        leader.total,
        rows
          .filter((c) => c.agencyId === leader.id)
          .reduce((n, c) => n + c.initialValue, 0),
      );
  }
});
test("combined filters, accent-insensitive search, sort and empty states work", () => {
  const c = {
    ...federal.contracts[0],
    agency: "Órgão de Saúde",
    supplierName: "Empresa Árvore",
  };
  const rows = [
    c,
    {
      ...c,
      id: "other",
      agencyId: "other",
      uf: "AC",
      initialValue: 0,
      publishedAt: "2099-01-01",
    },
  ];
  assert.equal(
    filterFederalContracts(rows, {
      ...filters,
      q: "arvore",
      org: c.agencyId,
      uf: c.uf,
      power: c.power,
    }).length,
    1,
  );
  assert.equal(
    filterFederalContracts(rows, { ...filters, q: "saude", sort: "date" })[0]
      .id,
    "other",
  );
  assert.equal(
    filterFederalContracts(rows, { ...filters, power: "unknown" }).length,
    0,
  );
  assert.equal(summarizeFederalContracts([]).total, 0);
  assert.equal(summarizeFederalContracts([rows[1]]).total, 0);
});
test("agency and supplier grouping uses identity, not names, and baseline emits no changes", () => {
  const c = federal.contracts[0];
  const result = summarizeFederalContracts([
    c,
    { ...c, id: "other", agencyId: "other", supplierId: "other" },
  ]);
  assert.equal(result.agencyCount, 2);
  assert.equal(result.supplierCount, 2);
  assert.deepEqual(federalHistoryBatches({ events: [] }), []);
  assert.deepEqual(
    federalHistoryBatches({
      events: [
        { sequence: 1, observedAt: "t", kind: "changed" },
        { sequence: 1, observedAt: "t", kind: "removed" },
      ],
    }),
    [{ sequence: 1, observedAt: "t", added: 0, changed: 1, removed: 1 }],
  );
});
