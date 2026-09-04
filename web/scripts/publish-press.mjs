import { readFile, writeFile } from "node:fs/promises";
import { reviewedArticles } from "./lib/press.mjs";
const input = JSON.parse(
  await readFile(new URL("../../content/press.json", import.meta.url), "utf8"),
);
const index = JSON.parse(
  await readFile(new URL("../public/data/index.json", import.meta.url), "utf8"),
);
const result = reviewedArticles(input, new Set(index.map((e) => e.id)));
await writeFile(
  new URL("../public/data/_press.json", import.meta.url),
  JSON.stringify(result),
);
console.log(`[publish-press] ${result.length} reviewed articles`);
