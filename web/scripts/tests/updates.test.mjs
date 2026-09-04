import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceHistory, graphRecords } from "../lib/updates.mjs";

const entry = { id: 7, name: "Pessoa Exemplo", party: "EX", uf: "SP" };
function graph(id = 1, description = "Doação de R$10,00 em 2022") {
  return {
    nodes: [
      { id, name: "Pessoa Exemplo", category: "politician" },
      { id: id + 1, name: "Doador Exemplo", category: "donor" },
    ],
    links: [
      { source: id + 1, target: id, connectionType: "doacao", description },
    ],
  };
}
test("IDs and input order do not create changes; UI-only rebuild preserves history", () => {
  const records = graphRecords(entry, graph());
  const first = advanceHistory(
    null,
    null,
    records,
    "2026-07-01T00:00:00Z",
    null,
  );
  assert.equal(first.history.batches[0].baseline, true);
  assert.deepEqual(first.history.batches[0].events, []);
  const next = advanceHistory(
    first.state,
    first.history,
    graphRecords(entry, graph(80)),
    "2026-08-01T00:00:00Z",
    null,
  );
  assert.equal(next.unchanged, true);
  assert.deepEqual(next.history, first.history);
});
test("changed donation is retained through a no-op build and records observation date", () => {
  const first = advanceHistory(
    null,
    null,
    graphRecords(entry, graph()),
    "2026-07-01T00:00:00Z",
    null,
  );
  const changed = advanceHistory(
    first.state,
    first.history,
    graphRecords(entry, graph(1, "Doação de R$20,00 em 2022")),
    "2026-07-02T00:00:00Z",
    "2026-06-30T00:00:00Z",
  );
  assert.equal(changed.history.batches[0].events[0].mode, "changed");
  assert.equal(changed.history.batches[0].events[0].kind, "doacao");
  assert.equal(changed.history.batches[0].observedAt, "2026-07-02T00:00:00Z");
  const again = advanceHistory(
    changed.state,
    changed.history,
    changed.state.records,
    "2026-07-03T00:00:00Z",
    null,
  );
  assert.deepEqual(again.history, changed.history);
});
test("removals retain the previous count and history is bounded", () => {
  let result = advanceHistory(
    null,
    null,
    graphRecords(entry, graph()),
    "2026-07-01T00:00:00Z",
    null,
  );
  result = advanceHistory(
    result.state,
    result.history,
    [],
    "2026-07-02T00:00:00Z",
    null,
  );
  assert.equal(result.history.batches[0].events[0].mode, "removed");
  assert.equal(result.history.batches[0].events[0].previousCount, 1);
  for (let i = 0; i < 35; i++)
    result = advanceHistory(
      result.state,
      result.history,
      graphRecords(entry, graph(1, `value ${i}`)),
      "2026-07-03T00:00:00Z",
      null,
    );
  assert.equal(result.history.batches.length, 30);
});
