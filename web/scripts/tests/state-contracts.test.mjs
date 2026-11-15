import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../../src/lib/state-contracts.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { contractDate, contractSourceDate, contractObservedAt, contractProfilePath, isContractFocusCurrent } =
  await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
  );
test("publication and signature dates do not shift to the previous day", () => {
  assert.equal(contractDate("2026-10-01"), "01/10/2026");
  assert.equal(contractDate("2026-10-01T00:00:00"), "01/10/2026");
  assert.equal(contractDate(null), "Não informado");
  assert.equal(contractDate("2026-11-14T00:30:00+00:00"), "13/11/2026");
});
const file = new URL(
  "../../public/data/_state-contracts.json",
  import.meta.url,
);
test("published PNCP snapshot reconciles coverage, identities and source records", async () => {
  const d = JSON.parse(await readFile(file, "utf8"));
  assert.equal(
    d.coverage.days.length,
    (Date.parse(d.period.end) - Date.parse(d.period.start)) / 86400000 + 1,
  );
  assert.equal(
    d.coverage.days.reduce((sum, day) => sum + day.nationalRecords, 0),
    d.coverage.nationalRecordsChecked,
  );
  assert.equal(
    d.coverage.days.reduce((sum, day) => sum + day.stateRecords, 0),
    d.coverage.stateRecordsChecked,
  );
  assert.equal(
    d.contracts.length +
      Object.values(d.coverage.excluded).reduce((a, b) => a + b, 0),
    d.coverage.stateRecordsChecked,
  );
  assert.equal(new Set(d.contracts.map((c) => c.id)).size, d.contracts.length);
  assert.equal(new Set(d.suppliers.map((s) => s.id)).size, d.suppliers.length);
  const supplierIds = new Set(d.suppliers.map((s) => s.id));
  const graphCache = new Map();
  for (const c of d.contracts) {
    assert.ok(supplierIds.has(c.supplierId));
    assert.ok(["SP", "MG", "RJ", "DF"].includes(c.uf));
    assert.ok(Number.isFinite(c.initialValue) && c.initialValue >= 0);
    assert.ok(
      c.publishedAt.slice(0, 10) >= d.period.start &&
        c.publishedAt.slice(0, 10) <= d.period.end,
    );
    assert.match(
      c.sourceUrl,
      /^https:\/\/pncp.gov.br\/app\/contratos\/\d{14}\/\d{4}\/\d+$/,
    );
    for (const [key, value] of Object.entries(c))
      if (typeof value === "string" && key !== "sourceUrl")
        assert.doesNotMatch(
          value,
          /\b\d{11}\b|\b\d{14}\b|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
        );
  }
  for (const s of d.suppliers)
    for (const c of s.connections) {
      let graph = graphCache.get(c.profileId);
      if (!graph) {
        graph = JSON.parse(
          await readFile(
            new URL(`../../public/data/${c.profileId}.json`, import.meta.url),
            "utf8",
          ),
        );
        graphCache.set(c.profileId, graph);
      }
      assert.equal(graph.meta.generatedAt, c.snapshot);
      assert.equal(
        graph.nodes.find((n) => n.id === c.nodeId)?.entityId,
        c.entityId,
      );
      const links = graph.links.filter(
        (l) => l.source === c.nodeId || l.target === c.nodeId,
      );
      assert.equal(
        c.direct,
        links.some((l) => l.source === c.profileId || l.target === c.profileId),
      );
      assert.deepEqual(
        [...new Set(links.map((l) => l.connectionType))].sort(),
        c.relationships,
      );
    }
  assert.ok(
    d.suppliers.some((s) => s.connections.length),
    "real graph matches must exist",
  );
});

test("supplier profile links cannot silently reuse a node from another snapshot", () => {
  const path = contractProfilePath({
    profileId: 123,
    nodeId: 8,
    snapshot: "2026-11-13T00:12:00Z",
  });
  const params = new URL(path, "https://example.test").searchParams;
  assert.equal(params.get("focus"), "8");
  assert.equal(params.get("cv"), "2026-11-13T00:12:00Z");
  assert.equal(
    isContractFocusCurrent(params.get("cv"), "2026-11-13T00:12:00Z"),
    true,
  );
  assert.equal(
    isContractFocusCurrent(params.get("cv"), "2026-11-14T00:12:00Z"),
    false,
  );
});

test("history preserves timestamp-only changes and distinguishes source timezone from observation time", () => {
  assert.notEqual(contractSourceDate("2026-11-13T10:00:00"), contractSourceDate("2026-11-13T15:00:00"));
  assert.match(contractSourceDate("2026-11-13T10:00:00"), /fuso não informado/);
  assert.match(contractObservedAt("2026-11-14T01:00:00Z"), /22:00:00 BRT/);
  assert.equal(contractSourceDate(null), "Não informado");
});
