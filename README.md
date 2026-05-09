# ASSUMPTIONS.md

Interpretations we made of ambiguous parts of the brief, plus discoveries mid-build.

## Schema interpretations

- **Brand normalized as a separate entity, not denormalized.** Each promotion holds a `brandId`. Brand metadata (hours, social links, website) lives once per brand. Trade-off rationale in DESIGN.md.
- **Stable promotion id:** the source-portal numeric id, prefixed `deal-{id}` (e.g. `deal-3146666`). Pulled from the URL pattern `/deals/<id>/`. Brand id is `brand-{id}`. Re-scrapes UPSERT on this id, so duplicates are impossible — that's our dedup strategy.
- **Dates** stored as `YYYY-MM-DD` strings (date-only, no timezone). `scrapedAt` is the only true datetime, stored as ISO 8601 UTC.
- **Missing-data policy:** `null` for missing scalars, `[]` for missing collections (e.g. `socialLinks`). Consistent across the codebase. Required-everywhere fields: `id`, `name`, `sourceUrl`, `brandId` (nullable), `scrapedAt`.

## Date-filter semantics

**Strict containment.** A promotion is included in date-filtered results only if its full run window (`startDate` and `endDate`) falls inside the filter window. Promotions with either date null are excluded from date-filtered results — we don't have enough information to confirm containment. Without a date filter, all promotions appear (including those with no date data).

We considered overlap semantics ("show what's running at any point in the window") and went with strict containment because it matches account-manager intent ("show me what's *only* running this week") more reliably. A future toggle between modes is a clean addition.

## POST /scrape: async with job ID

The `POST /scrape` endpoint returns `202 Accepted` with a `jobId` immediately; the scrape runs in the background; clients poll `GET /scrape/:jobId` for status. Job state is in-memory and resets on server restart — acceptable for an MVP, would persist in production.

We considered sync (block the HTTP request until scrape finishes), but a 12-minute request hangs through every reasonable proxy timeout. Async is the only honest choice once a real scrape exists.

## Politeness strategy (NFR2)

- **Concurrency = 1** (serial scraping). No parallel page fetches.
- **1-second delay** between requests.
- **Descriptive User-Agent**: `promotions-aggregator-takehome/0.1 (+contact: <email>)` — identifies us and gives the source admin a way to reach out.
- **`robots.txt`** not checked programmatically. The `/sales` and `/stores` paths are public listings; we manually verified they're not crawl-restricted. Adding a check is trivial, scoped out for time.

## Discoveries during the build

### The site is picky about HTTP clients (confirmed)
The brief warned about this. We confirmed by trying `fetch` directly: empty bodies for all four URLs we tried. Using Playwright (a real Chromium browser) sidesteps the entire issue — it negotiates redirects, headers, and any anti-fetch heuristics transparently. Bonus: `page.evaluate()` lets us run real DOM queries inside the browser instead of parsing HTML in Node.

### `__name` runtime error in `page.evaluate` callbacks
`tsx` (our TypeScript runner) compiles named arrow functions inside `page.evaluate` callbacks to `__name(fn, "name")` calls (esbuild's keep-names support). That helper isn't defined in the browser when Playwright serializes the callback. Fixed by injecting a `__name` no-op shim via `addInitScript` before any page navigation. The fix is two lines; the symptom would have looked baffling without naming the cause.

### Brand hours come from the mall, not the brand
Each brand page on the source shows the **mall's** general hours, not the individual store's hours. So most brands display the same `Mon – Sat: 10am – 8pm; Sun: 11am – 6pm`. We capture what's there (the `raw` field has the unparsed string); a `weekly` structured representation is null because writing a parser for the format wasn't worth the time. Per-store hours, where they actually differ, would be a follow-on.

### Brand `socialLinks` mix mall socials with brand socials
The brand page on the source includes both the brand's own socials (when present) and the mall's footer-level socials (Twitter/Facebook/Instagram of `ShopsBriargate`). We capture both; the mall ones appear on every brand. A real version would dedupe these per-brand or filter to "this brand's specific socials" using stricter heuristics.

### `websiteUrl` is sometimes an affiliate redirector
Some brands (Athleta, Sephora, Free People) link out via affiliate URLs (`tkqlhce.com`, `flexlinkspro.com`, `shopstyle.it`) instead of their canonical domains. We store the link as found; resolving to the canonical domain would require a HEAD-fetch chain, scoped out for time.

### Year-long evergreen discounts dominate
Many promotions are `01/01/2026 → 12/31/2026` evergreen offers (Columbia teacher/military/senior/student discounts, etc.). They behave correctly under our strict-containment date filter, but for "what's running this week" the overlap semantics would feel more useful. The toggle mentioned above would address this cleanly.

## What we cut for time

- **Hours parsing** — the `weekly` structured representation is null everywhere. The schema is in place; the parser is unwritten.
- **Description sanitization** — descriptions include legal disclaimer paragraphs. A real version would either truncate or move disclaimers to a separate field.
- **Image dimensions** — we capture URLs only; Next/Image with proper sizing would be a UI-quality win.
- **A real test suite** — only the `db-smoke` script is included, not unit/integration tests for parsers or routes. Running through the UI is the integration test.
- **URL-synced filter state** — the UI's filter state lives in React only. Reloading the page resets filters. Sharable filter URLs would be a nice next-iteration improvement.

## What I'd do with another 4 hours

1. Hours parser + use the `weekly` structured representation in the UI.
2. A toggle between **strict** and **overlap** date-filter semantics.
3. URL-synced filter state for sharable views.
4. Dockerfiles and docker-compose for true one-command bring-up.
5. Real tests for the date overlap math + the `findDateRange` parser — the most likely places to regress.

promotions-aggregator/
├── apps/
│   ├── api/                # Express server, scraper, DB
│   │   └── src/
│   │       ├── db/         # SQLite + repository functions
│   │       ├── scraper/    # Playwright orchestration + parsers
│   │       ├── server/     # Express app + routes
│   │       └── scripts/    # CLI entries (scrape, smoke tests)
│   └── web/                # Next.js UI
│       └── src/app/page.tsx  # Search, filter, pagination, group-by-brand
├── packages/
│   └── shared/             # Zod schemas, types, constants
├── data/                   # SQLite db file (gitignored)
├── DESIGN.md               # Decisions & trade-offs (committed before code)
├── ASSUMPTIONS.md          # Interpretations + mid-build discoveries
└── README.md               # You are here

## API endpoints

All under `http://localhost:4000`:

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Liveness check |
| `GET`  | `/promotions` | Paginated list. Query params: `search`, `startDate`, `endDate`, `brand`, `page`, `pageSize` |
| `GET`  | `/promotions/:id` | Single promotion |
| `GET`  | `/brands` | All brands with `promotionCount` and metadata |
| `POST` | `/scrape` | Kick off a scrape. Returns `{ jobId }` immediately (202 Accepted) |
| `GET`  | `/scrape/:jobId` | Poll job status |

Date filter semantics: **strict containment** (a promo is included only if its full run window fits inside the filter window). See ASSUMPTIONS.md.

## Scripts

| Command | What it does |
|---------|-------------|
| `pnpm scrape` | Run a scrape and persist results |
| `pnpm dev` | Run API + Web in parallel |
| `pnpm dev:api` | Run only the API |
| `pnpm dev:web` | Run only the web app |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm build` | Build all packages |

## Environment variables

Copy `.env.example` to `.env` to override defaults. Defaults work for local dev with no overrides.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | API port |
| `DATABASE_PATH` | `./data/promotions.db` | SQLite file location |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Where the web app calls the API. Must be `NEXT_PUBLIC_*` to be exposed in-browser. |

## Tests

Smoke tests (sanity, not exhaustive):

```bash
# Round-trip data through the DB layer
cd apps/api && pnpm exec tsx src/scripts/db-smoke.ts
```

A real test suite was deprioritized within the time budget — what's there is documented in DESIGN.md → "What we cut for time."

## Known limitations

See ASSUMPTIONS.md for the full list. Highlights:

- Brand hours are the mall's hours, not the per-store hours (source data limitation).
- Mall-level social links appear on every brand alongside the brand's own.
- Some brand websites resolve as affiliate-redirector URLs.
- Hours `weekly` parsing is unwritten — only the raw string is populated.

## Time spent

Approximately **6** hours.