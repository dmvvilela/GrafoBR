import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(new URL("../../src/lib/comparison.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { sharedConnections, comparisonPath, comparisonVersion, selectionForVersion } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
function graph(id, name = "Empresa Exemplo", entityId = "e1") {
  return { meta: { egoId: id, generatedAt: "2026-09-04T03:41:31Z" }, nodes: [
    { id, name: `Parlamentar ${id}`, category: "politician" },
    { id: 100, name, category: "supplier", entityId },
  ], links: [{ id: 1, source: id, target: 100, connectionType: "despesa", description: "Registro" }] };
}
test("namesakes with different or missing identities never match", () => {
  assert.equal(sharedConnections(graph(1), graph(2, "Empresa Exemplo", "e2")).length, 0);
  const noIdentity = graph(2); delete noIdentity.nodes[1].entityId;
  assert.equal(sharedConnections(graph(1), noIdentity).length, 0);
});
test("identity matches across label/category variants and preserves evidence on each side", () => {
  const a = graph(1); const b = graph(2, "Outra razão social");
  b.nodes[1].category = "company";
  b.links = [{ id: 7, source: 100, target: 2, connectionType: "socio", description: "Sócio" }];
  const [shared] = sharedConnections(a, b);
  assert.equal(shared.left.name, "Empresa Exemplo");
  assert.equal(shared.right.name, "Outra razão social");
  assert.deepEqual(shared.leftLinks, a.links);
  assert.deepEqual(shared.rightLinks, b.links);
});
test("a second-hop contract is not represented as a direct politician relation", () => {
  const b = graph(2); b.links[0].source = 200; b.links[0].connectionType = "contrato";
  assert.equal(sharedConnections(graph(1), b).length, 0);
});
test("self comparison and empty graphs have no shared results", () => {
  assert.equal(sharedConnections(graph(1), graph(1)).length, 0);
  const b = graph(2); b.links = [];
  assert.equal(sharedConnections(graph(1), b).length, 0);
});
test("share URL round-trips a version-bound selection and rejects recycled IDs", () => {
  const a = graph(1); const b = graph(2); const shared = sharedConnections(a, b);
  const version = comparisonVersion(a, b);
  const url = new URL(comparisonPath("1", "2", "e1", version), "https://example.com");
  assert.equal(url.searchParams.get("v"), version);
  assert.equal(selectionForVersion(shared, url.searchParams.get("entity"), url.searchParams.get("v"), version), "e1");
  assert.equal(selectionForVersion(shared, "e1", "old snapshot", version), null);
  assert.equal(selectionForVersion(shared, "e99", version, version), null);
  assert.equal(selectionForVersion(shared, "e1", null, version), null);
});
