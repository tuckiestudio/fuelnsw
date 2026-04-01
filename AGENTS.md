# AusFuel — Project Guide

NSW fuel price tracker. Fetches prices from the NSW Government Fuel Check API every 6 hours, stores in SQLite, and serves two independent SvelteKit apps: a user-facing map/summary site and a standalone analytics dashboard.

## Repository Structure

```
ausfuel/
├── package.json              # npm workspaces root
├── data/                     # SQLite DB + postcode boundaries (gitignored)
│   └── fuelnsw.sqlite
├── scripts/
│   ├── import-history.ts     # Historical price importer (XLSX + API)
│   └── migrate-dashboard.ts  # One-time dashboard migration script
├── packages/
│   └── shared/               # @fuelnsw/shared — all shared code
│       ├── package.json
│       └── src/
│           ├── index.ts              # Barrel: re-exports types + fuel-types
│           ├── api/
│           │   ├── types.ts          # All TypeScript interfaces
│           │   └── nsw-fuel-client.ts # NSW Gov API client (OAuth + fetch)
│           ├── db/
│           │   ├── client.ts         # SQLite connection (lazy singleton)
│           │   ├── schema.ts         # CREATE TABLE statements
│           │   ├── stations.ts       # Station CRUD + GeoJSON queries
│           │   ├── prices.ts         # Live price upsert + queries
│           │   ├── availability.ts   # Fuel drop/add detection + dry stations
│           │   ├── analysis.ts       # Price analysis helpers
│           │   ├── regions.ts        # SA4 regions, brand stats, weekly aggregates
│           │   ├── weekly-aggregation.ts # Weekly aggregation computation
│           │   └── mock-data.ts      # Dev seed data
│           ├── utils/
│           │   ├── fuel-types.ts     # Fuel type mappings (FUEL_TYPE_MAP, FUEL_OPTIONS)
│           │   └── parse-address.ts  # Address → suburb/postcode parser
│           ├── cache.ts              # node-cache wrapper (30s TTL)
│           └── scheduler.ts          # 6-hour refresh + weekly aggregation
├── apps/
│   ├── web/                  # User-facing app (port 3000)
│   │   ├── .env              # NSW_FUEL_KEY, NSW_FUEL_SECRET, ADMIN_TOKEN, DATA_DIR
│   │   ├── svelte.config.js  # adapter-node, runes, $components alias
│   │   ├── vite.config.ts    # @fuelnsw/shared → packages/shared/src alias
│   │   └── src/
│   │       ├── hooks.server.ts      # DB init, scheduler, rate limit, compression
│   │       ├── routes/
│   │       │   ├── +page.svelte          # Map page (leaflet + markers)
│   │       │   ├── +layout.svelte        # Nav: Map | Summary
│   │       │   ├── summary/+page.svelte  # Price summary + availability
│   │       │   └── api/                   # See API section below
│   │       └── components/
│   │           └── station/
│   │               └── PriceChart.svelte  # chart.js historical price line chart
│   └── dashboard/            # Analytics dashboard (port 3001)
│       ├── .env              # DATA_DIR only (read-only, no API keys needed)
│       ├── svelte.config.js  # adapter-node, runes, $components alias
│       ├── vite.config.ts    # @fuelnsw/shared → packages/shared/src alias
│       └── src/
│           ├── hooks.server.ts      # Schema init (CREATE IF NOT EXISTS), rate limit, compression. NO scheduler.
│           ├── routes/
│           │   ├── +page.svelte          # Dashboard (promoted from /dashboard to /)
│           │   ├── +layout.svelte        # Standalone nav branding
│           │   └── api/dashboard/        # See API section below
│           ├── components/
│           │   └── dashboard/            # 8 components: charts, filters, map, cards
│           └── lib/
│               └── chart-colors.ts       # Dashboard-local color palette
```

## Commands

```bash
# Development (both apps)
npm run dev:web          # http://localhost:3000
npm run dev:dashboard    # http://localhost:3001

# Build
npm run build:web
npm run build:dashboard

# Type checking
npm run check:web
npm run check:dashboard

# Historical data import
npm run import:history          # Full import (API + XLSX)
npm run import:history:dry      # Dry run
npm run import:history:api      # API data only
npm run import:history:xlsx     # XLSX archive only
```

## Environment Variables

Both apps load `.env` from their own directory. Vite sets `process.cwd()` to the app directory (e.g. `apps/web/`) when running via npm workspaces.

| Variable | Where | Description |
|---|---|---|
| `NSW_FUEL_KEY` | web | NSW Gov API key |
| `NSW_FUEL_SECRET` | web | NSW Gov API secret |
| `ADMIN_TOKEN` | web | Auth token for POST /api/refresh |
| `DATA_DIR` | both | Path to data directory. Relative from app dir: `../../data` |

### Web app `.env` example (`apps/web/.env`)
```
NSW_FUEL_KEY=your_key
NSW_FUEL_SECRET=your_secret
ADMIN_TOKEN=your_token
DATA_DIR=../../data
```

### Dashboard `.env` example (`apps/dashboard/.env`)
```
DATA_DIR=../../data
```

A root `.env` also exists for running scripts directly from the monorepo root.

## Database Schema

SQLite at `data/fuelnsw.sqlite`. WAL mode. Managed via `better-sqlite3`.

### Core tables (created by `initializeSchema()`)

| Table | Purpose | Key columns |
|---|---|---|
| `stations` | Service stations | `code` (PK), `name`, `brand`, `brand_group`, `suburb`, `postcode`, `latitude`, `longitude` |
| `live_prices` | Current prices | `station_code` FK, `fuel_type`, `price`, `last_updated`, `fetched_at`. UNIQUE(station_code, fuel_type) |
| `historical_prices` | Time series | `station_code` FK, `fuel_type`, `price`, `price_updated`. UNIQUE(station_code, fuel_type, price_updated) |
| `station_fuel_inventory` | Fuel type tracking | PK(station_code, fuel_type), `first_seen`, `last_seen`, `total_records` |
| `daily_snapshots` | Daily price snapshots | UNIQUE(snapshot_date, station_code, fuel_type) |
| `refresh_log` | Data refresh history | `fetched_at`, `stations_count`, `prices_count` |
| `fuel_availability_events` | Drop/add detection | `station_code`, `fuel_type`, `event_type` ('dropped'\|'added'), `detected_at` |
| `pending_drops` | Unconfirmed drops | PK(station_code, fuel_type), `miss_count`, `previous_price` |

### Dashboard tables (created outside `initializeSchema`, exist in production DB)

| Table | Purpose | Key columns |
|---|---|---|
| `postcode_sa4_mapping` | Postcode → SA4 region | `postcode` (PK), `sa4_region` |
| `weekly_price_aggregates` | Pre-computed weekly stats | PK(week_start, sa4_region, brand_group, fuel_type), `avg_price`, `min_price`, `max_price`, `station_count` |

### Station codes

- Live stations: numeric codes (e.g. `1065`, `38632`)
- Historical import stations: prefixed `hist_` + hash (e.g. `hist_9vfho8`)
- The history API matches live stations to their `hist_` counterpart via `LOWER(name)` matching

### `brand_group` column on `stations`

Grouped brands: `Ampol` (includes EG Ampol, Ampol Foodary, etc.), `Caltex` (includes Caltex Woolworths), `Independent`. Other brands have their own `brand_group` value. Used by dashboard aggregation queries.

## API Endpoints

### Web app (`apps/web`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/fuel/stations` | GET | All stations with live prices as GeoJSON |
| `/api/fuel/stations/viewport?south,west,north,east,fuel` | GET | Stations within map bounds |
| `/api/fuel/station/[code]` | GET | Single station detail + prices |
| `/api/fuel/prices` | GET | All live prices |
| `/api/fuel/history?station=CODE&fuel=TYPE` | GET | Monthly-averaged historical prices for one station+fuel (merges `hist_` data) |
| `/api/fuel/history/batch?station=CODE` | GET | History for all fuel types at once |
| `/api/dry-stations` | GET | Stations that recently dropped fuel types |
| `/api/postcode-boundary?postcode=N` | GET | GeoJSON boundary for a postcode |
| `/api/health` | GET | Health check (DB status, station count, last refresh) |
| `/api/refresh` | POST | Trigger data refresh (requires `Authorization: Bearer ADMIN_TOKEN`) |

### Dashboard app (`apps/dashboard`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/dashboard/stats` | GET | Summary stats + fuel type breakdown + last updated |
| `/api/dashboard/summary` | GET | Aggregated price summary with min/max locations |
| `/api/dashboard/brands` | GET | Brand-level price statistics |
| `/api/dashboard/regions` | GET | SA4 region list with station counts |

All dashboard endpoints accept optional query params: `regions`, `brands`, `fuels`, `months`.

## Coding Conventions

- **Svelte 5 runes mode** — all `.svelte` files use runes (`$state`, `$props`, `$effect`, `$derived`). The `runes: true` compiler option is set in `svelte.config.js`.
- **No comments** — do not add comments to code unless explicitly asked.
- **TypeScript** — all logic in `.ts` files. Svelte components use `lang="ts"`.
- **Imports from shared** — use `@fuelnsw/shared/db/client`, `@fuelnsw/shared/api/types`, etc. The Vite alias resolves `@fuelnsw/shared` → `packages/shared/src`. Subpath imports work because Vite resolves them as filesystem paths.
- **Component alias** — `$components` maps to `src/components` in both apps (set in `svelte.config.js`).
- **CSS** — Tailwind v4 via `@tailwindcss/vite` plugin. Single `@import 'tailwindcss'` in `app.css`.
- **Charts** — `chart.js` loaded dynamically via `import('chart.js')` in components (not bundled in SSR).
- **Maps** — `leaflet` + `leaflet.markercluster`. Marker cluster for web app map.
- **Server-only code** — DB imports and scheduler live in `packages/shared` and are only used in `+server.ts` files and `hooks.server.ts`. Never import DB modules in client-side code.

## Architecture Decisions

### Two-app split
Web app serves the public (map + summary) and owns the data refresh scheduler. Dashboard is a standalone read-only analytics app that reads from the same SQLite file. They can be deployed independently.

### Shared package
`@fuelnsw/shared` contains all business logic (DB, API client, types, scheduler). Both apps depend on it via npm workspaces (`"@fuelnsw/shared": "*"`). The Vite alias in each app resolves it to the filesystem path so HMR works in dev.

### Cache strategy
Web app uses a 30-second TTL `node-cache` for API responses. Dashboard uses the same. There is no cross-process cache invalidation — each app's cache simply expires.

### Scheduler
Runs only in the web app (`hooks.server.ts` triggers `startScheduler()`). Runs every 6 hours, fetches from NSW Gov API, upserts stations + prices, detects availability changes, and schedules weekly aggregation at 2 AM Sydney time. Dashboard never triggers data refreshes.

## Gotchas

1. **`DATA_DIR` resolution** — The DB client (`packages/shared/src/db/client.ts`) resolves `DATA_DIR` lazily on first `getDb()` call, not at module import time. This is because Vite loads `.env` after module evaluation. If `DATA_DIR` is not set, it defaults to `process.cwd()/data`.

2. **Vite cwd in workspaces** — When running `npm run dev --workspace=web`, Vite sets `process.cwd()` to `apps/web/`, not the monorepo root. So relative paths in `.env` must be relative to `apps/web/` (e.g. `../../data`).

3. **`hist_` station matching** — Historical data imported via `import-history.ts` creates `hist_` prefixed station codes. The history API (`/api/fuel/history`) matches these to live numeric stations by comparing `LOWER(name)`. This is fragile — if station names change in the API, the match breaks.

4. **Dashboard regions query** — The `getSA4Regions()` function was rewritten to use two separate queries instead of a triple JOIN (postcode_sa4_mapping × stations × weekly_price_aggregates). The old join on 190K+ aggregate rows caused 90+ second response times.

5. **Prepared statement caching** — The history API caches prepared statements by key. Cache keys must be unique per SQL string. Reusing a key with different SQL silently returns the wrong cached statement.

6. **`brand_group` not in schema.ts** — The `brand_group` column on `stations` and the `postcode_sa4_mapping`/`weekly_price_aggregates` tables exist in production but are not in `initializeSchema()`. They were created by migration scripts. The dashboard hooks call `initializeSchema()` to ensure base tables exist, but the extra tables must already be present.
