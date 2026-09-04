import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewedArticles } from "../lib/press.mjs";
const article = {
  status: "reviewed",
  title: "Título sintético",
  publisher: "Veículo exemplo",
  url: "https://example.org/article",
  publishedAt: "2026-01-01T12:00:00Z",
  reviewedAt: "2026-01-02T12:00:00Z",
  politicianIds: [7],
};
const publish = (items) =>
  reviewedArticles(items, new Set([7]), new Date("2026-02-01T00:00:00Z"));
test("drafts never publish and review control is not leaked into output", () => {
  assert.deepEqual(publish([{ status: "draft" }]), []);
  assert.equal(publish([article])[0].status, undefined);
  assert.equal(publish([article])[0].title, article.title);
});
test("unsafe links, unknown profiles, duplicate URLs and unreviewed dates fail", () => {
  assert.throws(() => publish([{ ...article, url: "javascript:alert(1)" }]));
  assert.throws(() => publish([{ ...article, politicianIds: [123] }]));
  assert.throws(() =>
    publish([article, { ...article, url: article.url + "#text" }]),
  );
  assert.throws(() => publish([{ ...article, reviewedAt: null }]));
  assert.throws(() =>
    publish([{ ...article, reviewedAt: "2027-01-01T00:00:00Z" }]),
  );
});
