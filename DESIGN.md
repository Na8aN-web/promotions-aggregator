# DESIGN.md

A 1-page design doc written before code. Decisions, trade-offs, and what we'd cut for time.

## Stack

- **Monorepo** via pnpm workspaces: `apps/api` (Express + TypeScript), `apps/web` (Next.js + TypeScript), `packages/shared` (Zod schemas + inferred types — the single source of truth).
- **Database:** SQLite via `better-sqlite3`. Zero-config, file-based, easy to inspect, fits the scope. Schema is portable to Postgres if needed later.
- **Scraping:** Playwright (headless Chromium).
- **Containerization:** Docker Compose runs API + Web with one command. SQLite file mounted as a volume.

## Scraping approach

The brief warns the site is picky about HTTP clients (redirects, headers). We chose **Playwright** over a lightweight `axios + cheerio` setup because Playwright runs a real browser — redirects, cookies, JS rendering, and any anti-naive-fetch heuristics are handled transparently. Heavier dependency (~300MB), but worth it for reliability when we don't control the source.

Pipeline:
1. Load the listing page, collect promotion cards (name, link, image, dates if present).
2. For each promotion, walk into its detail page to capture description and any extra fields the listing omits.
3. For each unique brand encountered, walk to the brand's directory page on the same site to capture website, hours, social links.
4. Upsert promotions and brands into SQLite, keyed by stable IDs.

**Politeness strategy:**
- Serial scraping (concurrency = 1).
- 1-second delay between requests.

## Schema choices

**Normalized.** Promotions and Brands are separate tables; each promotion holds a `brandId` foreign key.

Why normalized over denormalized:
- Brand metadata (hours, socials, website) is shared across all promotions for that brand. Denormalizing duplicates it on every row and risks drift across re-scrapes.
- The group-by-brand view (FR9) is a natural `GROUP BY brand` query on a normalized schema; denormalized, it works but invites bugs.
- Cost: one extra join when listing promotions. Negligible at this scale.

**Stable IDs:** canonical source URL hashed to a short slug. Re-scrapes use `INSERT OR REPLACE` — never duplicates. This is the dedup strategy.

**Missing data:** `null` for missing scalars (e.g., `endDate?`), `[]` for missing collections (e.g., `socialLinks`). Required fields: `id`, `name`, `sourceUrl`, `brandId`, `scrapedAt`. Documented in ASSUMPTIONS.md.

## POST /scrape: async with job ID

Sync would block the HTTP request for 60s+ and exceeds NFR3's 5s envelope (the brief exempts the scrape itself, but the *request* should still return promptly).

Pattern:
- `POST /scrape` → returns `202 Accepted` with `{ jobId }` immediately.
- Scrape runs in the background.
- `GET /scrape/:jobId` → `{ status: "running" | "done" | "failed", error?, finishedAt? }`.

Job state lives in an in-memory `Map`. Trade-off: jobs vanish on server restart. Acceptable for a single-mall MVP; a real deployment would persist job state.

## Failure modes

- **Bad records during scrape** → log + skip, don't crash the API (NFR5).
- **Site DOM changes** → wrap each parser in try/catch; partial failures don't poison the whole run.
- **Brand page can't be located for a promotion** → store the promotion with `brandId = null`, log a warning. Better than dropping data.
- **Network errors** → one retry with a fixed 2s delay, then skip and log.
- **Schema validation fails** at API boundary → Zod returns a 400 with the validation error.

## What we cut for time

- Comprehensive test suite. We include 1–2 smoke tests (one for the schema, one for a parser), not full coverage.
- Exponential backoff on retries — fixed delay is enough at this scale.
- Cursor-based pagination — page-number is simpler and the brief accepts either.
- Postgres deployment path — SQLite is enough; Postgres swap is a small change.
- Polished design system. Functional UI with clear hierarchy, per the brief's explicit allowance.
- Authentication. Explicitly a non-goal.

## Open questions logged in ASSUMPTIONS.md

(Anything ambiguous in the brief, plus discoveries mid-build, will land there.)