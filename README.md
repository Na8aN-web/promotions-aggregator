# Promotions Aggregator (Single-Mall MVP)

Take-home build: scrapes promotions from a single mall portal, persists them, exposes them via a typed REST API, and renders a UI with search, date filtering, pagination, and a group-by-brand view.

Source portal: [thepromenadeshopsatbriargate.com/sales](https://www.thepromenadeshopsatbriargate.com/sales)

## Stack

- **Monorepo**: pnpm workspaces.
  - `apps/api` — Express + TypeScript backend
  - `apps/web` — Next.js 16 (App Router) + Tailwind 4 frontend
  - `packages/shared` — Zod schemas + inferred TS types (single source of truth, FR10)
- **Scraper**: Playwright (headless Chromium)
- **Database**: SQLite via `better-sqlite3`

## Prerequisites

- **Node.js 22 LTS** (Node 24+ trips `better-sqlite3`'s native build on Windows)
- **pnpm 9+** (`npm install -g pnpm`)
- Git
## Docker (one-command bring-up)

```bash
docker compose up --build
```

The first build takes ~5–10 min (Chromium downloads inside the API image). After that, both servers boot in seconds.

Open <http://localhost:3000>.

If you already ran `pnpm scrape` locally, the volume mount on `./data` means the API container sees your existing DB — nothing more to do.

If the DB is empty (fresh clone, no local scrape), trigger one inside the container:

```bash
curl -X POST http://localhost:4000/scrape
# returns { jobId: "...", status: "queued" }
# poll with: curl http://localhost:4000/scrape/<jobId>
```

Refresh <http://localhost:3000> after the job reports `"status": "done"`.

Stop with `Ctrl+C`, or `docker compose down` to clean up.

## Quick start

```bash
git clone <this-repo-url>
cd promotions-aggregator

# Install everything (deps + Playwright Chromium via postinstall hook)
pnpm install

# Populate the SQLite DB by running a fresh scrape (~12 minutes — intentional politeness)
pnpm scrape

# Boot API on :4000 and Web on :3000 in parallel
pnpm dev
```

Open <http://localhost:3000> in your browser.

> **Tip:** to bring everything up in two commands, chain the first two: `pnpm install && pnpm scrape && pnpm dev`.

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
