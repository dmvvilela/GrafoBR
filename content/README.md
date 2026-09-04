# Reviewed press context

`press.json` is an editorial input, not a scraper. Only entries with `status: "reviewed"`
are published by `pnpm sync-data` / the web build. Start new entries as `draft`.
Verify the full article, original publisher/date, and the association to each existing
GrafoBR politician ID before setting `reviewedAt` and marking it reviewed. A headline
match alone is insufficient. Prefer the original publisher; retain its headline without
adding allegations. Articles never create graph relationships or risk scores.

Each reviewed entry has exactly these fields:

- `status`: `reviewed` (or `draft` to withhold it)
- `title`: original headline
- `publisher`: outlet name
- `url`: direct HTTPS article URL
- `publishedAt`: original publication timestamp, including timezone
- `reviewedAt`: review timestamp, including timezone
- `politicianIds`: existing numeric profile IDs (not CPF/CNPJ)

There are no seeded articles: an empty section is preferable to an unverified association.
For corrections, change the entry back to `draft` and rebuild; it is removed from the
published list. Publication/review dates, duplicate URLs and profile IDs are validated.
