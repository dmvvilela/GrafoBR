export function reviewedArticles(input, profileIds, now = new Date()) {
  if (!Array.isArray(input)) throw new Error("Press input must be an array");
  const urls = new Set();
  const result = [];
  for (const item of input) {
    if (!["draft", "reviewed"].includes(item.status))
      throw new Error("Press item needs draft/reviewed status");
    if (item.status === "draft") continue;
    const allowed = new Set([
      "status",
      "title",
      "publisher",
      "url",
      "publishedAt",
      "reviewedAt",
      "politicianIds",
    ]);
    if (Object.keys(item).some((key) => !allowed.has(key)))
      throw new Error("Unexpected field in reviewed press item");
    for (const key of [
      "title",
      "publisher",
      "url",
      "publishedAt",
      "reviewedAt",
    ]) {
      if (typeof item[key] !== "string" || !item[key].trim())
        throw new Error(`Reviewed press item missing ${key}`);
    }
    const url = new URL(item.url);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Press links must use HTTPS without credentials");
    url.hash = "";
    if (urls.has(url.href)) throw new Error("Duplicate reviewed article URL");
    urls.add(url.href);
    for (const key of ["publishedAt", "reviewedAt"]) {
      if (
        !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(item[key]) ||
        !Number.isFinite(Date.parse(item[key])) ||
        Date.parse(item[key]) > now.getTime()
      )
        throw new Error(`Invalid/future press ${key}`);
    }
    if (Date.parse(item.reviewedAt) < Date.parse(item.publishedAt))
      throw new Error("Review cannot precede publication");
    if (
      !Array.isArray(item.politicianIds) ||
      !item.politicianIds.length ||
      item.politicianIds.some(
        (id) => !Number.isSafeInteger(id) || !profileIds.has(id),
      )
    )
      throw new Error(
        "Reviewed article must reference existing politician IDs",
      );
    const { status, ...article } = item;
    result.push({
      ...article,
      politicianIds: [...new Set(item.politicianIds)],
      url: url.href,
    });
  }
  return result.sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
}
