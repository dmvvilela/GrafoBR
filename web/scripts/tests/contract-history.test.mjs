import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../../src/lib/contract-history.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const {
  parseFollows,
  unreadEvents,
  eventMatches,
  allKnownContracts,
  allKnownSuppliers,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const supplier = "f" + "1".repeat(20),
  other = "f" + "2".repeat(20);
const before = {
  id: "contract",
  uf: "SP",
  supplierId: supplier,
  supplierName: "Original",
};
const after = { ...before, uf: "MG", supplierId: other, supplierName: "New" };
const events = [{ id: "event", sequence: 2, before, after }];
test("changes reach both previous and current state/supplier; overlap is counted once", () => {
  assert.ok(eventMatches(events[0], "state:SP"));
  assert.ok(eventMatches(events[0], "state:MG"));
  assert.ok(eventMatches(events[0], `supplier:${supplier}`));
  assert.ok(eventMatches(events[0], `supplier:${other}`));
  const follows = [
    { key: "state:SP", seen: 1, baseline: "base" },
    { key: `supplier:${supplier}`, seen: 0, baseline: "base" },
  ];
  assert.equal(unreadEvents(events, follows, "base").length, 1);
  assert.equal(
    unreadEvents(
      events,
      follows.map((f) => ({ ...f, seen: 2 })),
      "base",
    ).length,
    0,
  );
  assert.equal(unreadEvents(events, follows, "different-history").length, 0);
});
test("preferences reject corrupt, duplicate, invalid and incompatible storage", () => {
  const item = {
    key: "state:SP",
    name: "São Paulo",
    seen: 2,
    baseline: "base",
  };
  assert.deepEqual(parseFollows(null), []);
  assert.deepEqual(
    parseFollows(JSON.stringify({ version: 1, items: [item] })),
    [item],
  );
  for (const value of [
    "{",
    JSON.stringify({ version: 2, items: [] }),
    JSON.stringify({ version: 1, items: [item, item] }),
    JSON.stringify({ version: 1, items: [{ ...item, seen: -1 }] }),
    JSON.stringify({ version: 1, items: [{ ...item, key: "state:XX" }] }),
  ])
    assert.throws(() => parseFollows(value));
});
test("removed contract and supplier links remain resolvable without inventing current graph connections", () => {
  const snapshot = {
    contracts: [],
    suppliers: [],
    history: { events: [{ before, after: null }] },
  };
  assert.equal(allKnownContracts(snapshot)[0].id, before.id);
  assert.deepEqual(allKnownSuppliers(snapshot)[0].connections, []);
  snapshot.contracts = [after];
  snapshot.history.events.push({ before, after });
  assert.equal(allKnownSuppliers(snapshot).length, 2);
  assert.equal(allKnownContracts(snapshot).length, 1);
  assert.equal(allKnownContracts(snapshot)[0].supplierId, other);
});
