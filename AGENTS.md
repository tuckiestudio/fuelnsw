# Fuel Scout NSW — Project Guide

NSW fuel price tracker. Fetches prices from the NSW Government Fuel Check API every 6 hours, stores in SQLite, and serves two independent SvelteKit apps: a user-facing map/summary site and a standalone analytics dashboard.

## Repository Structure

```
ausfuel/
├── package.json              # npm workspaces root
├── data/                     # SQLite DB + postcode boundaries (gitignored)
├── scripts/
│   ├── import-history.ts     # Historical price importer (CKAN API + XLSX)
│   ├── migrate-dashboard.ts  # One-time dashboard migration script
│   └── push-opening-hours.sh # Push opening hours from local DB to production
├── packages/shared/          # @fuelnsw/shared — DB, API client, types, scheduler
│   └── src/
│       ├── api/              # types.ts, nsw-fuel-client.ts, google-places-client.ts
│       ├── db/               # client.ts, schema.ts, stations.ts, prices.ts, etc.
│       ├── utils/            # fuel-types.ts, parse-address.ts
│       ├── cache.ts          # node-cache wrapper (30s TTL)
│       └── scheduler.ts      # 6-hour refresh + weekly aggregation + opening hours
├── apps/web/                 # User-facing app (port 3000)
│   └── src/
│       ├── hooks.server.ts   # DB init, scheduler, rate limit, compression, security headers
│       ├── routes/           # Map page, summary page, API endpoints
│       ├── components/map/   # SearchBar, FuelTypeSelector, StationPanel, QuickFuel*, etc.
│       └── lib/              # preferences, navigation, ads, subscription
├── apps/dashboard/           # Analytics dashboard (port 3001)
│   └── src/
│       ├── hooks.server.ts   # Schema init, rate limit, compression (NO scheduler)
│       ├── routes/           # Dashboard page, API endpoints
│       └── components/dashboard/
└── docs/                     # Setup guides (domain-setup.md)
```

## Commands

```bash
npm run dev:web          # http://localhost:3000
npm run dev:dashboard    # http://localhost:3001
npm run build:web        # Build web app
npm run build:dashboard  # Build dashboard
npm run check:web        # Type check web
npm run check:dashboard  # Type check dashboard
npm run import:history   # Import historical prices (CKAN + XLSX)
npm run import:history:dry  # Dry run
```

## Environment Variables

Both apps load `.env` from their own directory. Vite sets `process.cwd()` to the app directory.

| Variable | Where | Description |
|---|---|---|
| `NSW_FUEL_KEY` | web | NSW Gov API key |
| `NSW_FUEL_SECRET` | web | NSW Gov API secret |
| `ADMIN_TOKEN` | web | Auth token for POST /api/refresh (compared with `timingSafeEqual`) |
| `DATA_DIR` | both | Path to data directory. Relative from app dir: `../../data` |
| `ORIGIN` | both | Full URL for HSTS header (e.g. `https://yourdomain.com.au`) |
| `CORS_ORIGINS` | web | Comma-separated origins allowed for API CORS (leave empty to disable) |
| `GOOGLE_PLACES_API_KEY` | web | Google Places API key for fetching station opening hours (optional) |

### Web app `.env` example (`apps/web/.env`)
```
NSW_FUEL_KEY=your_key
NSW_FUEL_SECRET=your_secret
ADMIN_TOKEN=your_token
DATA_DIR=../../data
CORS_ORIGINS=https://yourdomain.com.au
```

### Dashboard `.env` example (`apps/dashboard/.env`)
```
DATA_DIR=../../data
```

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

### Dashboard tables (created by migration scripts, not in `initializeSchema`)

| Table | Purpose | Key columns |
|---|---|---|
| `postcode_sa4_mapping` | Postcode → SA4 region | `postcode` (PK), `sa4_region` |
| `weekly_price_aggregates` | Pre-computed weekly stats | PK(week_start, sa4_region, brand_group, fuel_type) |

### Station codes

- Live stations: numeric codes (e.g. `1065`, `38632`)
- Historical import stations: prefixed `hist_` + hash (e.g. `hist_9vfho8`)
- Matched via `LOWER(name)` comparison

## API Endpoints

### Web app (`apps/web`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/fuel/stations` | GET | All stations with live prices as GeoJSON |
| `/api/fuel/stations/viewport?south,west,north,east,fuel` | GET | Stations within map bounds |
| `/api/fuel/stations/nearest?lat,lng,fuel,limit` | GET | Nearest cheapest stations (20km, sorted by price) |
| `/api/fuel/station/[code]` | GET | Single station detail + prices |
| `/api/fuel/prices` | GET | All live prices |
| `/api/fuel/history?station=CODE&fuel=TYPE` | GET | Monthly-averaged historical prices (merges `hist_` data) |
| `/api/fuel/history/batch?station=CODE` | GET | History for all fuel types at once |
| `/api/dry-stations` | GET | Stations that recently dropped fuel types |
| `/api/postcode-boundary?postcode=N` | GET | GeoJSON boundary for a postcode (NSW 2000-2999 only) |
| `/api/geolocate` | GET | Server-side IP geolocation proxy (ip-api.com). Validates IP from `x-forwarded-for` |
| `/api/health` | GET | Health check (status, DB connection, data freshness) |
| `/api/refresh` | POST | Trigger data refresh (requires `Authorization: Bearer ADMIN_TOKEN`, timing-safe comparison) |

### Dashboard app (`apps/dashboard`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/dashboard/stats` | GET | Summary stats + fuel type breakdown |
| `/api/dashboard/summary` | GET | Aggregated price summary with min/max locations |
| `/api/dashboard/brands` | GET | Brand-level price statistics |
| `/api/dashboard/regions` | GET | SA4 region list with station counts |

All dashboard endpoints accept optional query params: `regions`, `brands`, `fuels`, `months`.

## Coding Conventions

- **Svelte 5 runes mode** — `$state`, `$props`, `$effect`, `$derived`. `runes: true` in `svelte.config.js`.
- **No comments** — do not add comments unless explicitly asked.
- **TypeScript** — all logic in `.ts` files. Svelte components use `lang="ts"`.
- **Imports from shared** — `@fuelnsw/shared/db/client`, etc. Vite alias resolves to `packages/shared/src`.
- **Component alias** — `$components` → `src/components` in both apps.
- **CSS** — Tailwind v4 via `@tailwindcss/vite`. Single `@import 'tailwindcss'` in `app.css`.
- **Charts** — `chart.js` loaded dynamically via `import('chart.js')` (not bundled in SSR).
- **Maps** — `leaflet` + `leaflet.markercluster`.
- **Server-only code** — DB and scheduler imports only in `+server.ts` and `hooks.server.ts`. Never import in client-side code.

## Architecture

### Two-app split
Web app serves the public (map + summary) and owns the data refresh scheduler. Dashboard is a standalone read-only analytics app that reads from the same SQLite file. They can be deployed independently.

### Security

Both apps set security headers in `hooks.server.ts`:
- `Content-Security-Policy` (enforced, not report-only)
- `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- `Strict-Transport-Security` (when `ORIGIN` env var is set)
- Rate limiting: 60 req/min per IP on API routes (in-memory, rightmost IP from `x-forwarded-for`)
- CORS: opt-in via `CORS_ORIGINS` env var, with OPTIONS preflight handling

Web app specific:
- Admin token comparison uses `crypto.timingSafeEqual` (not `===`)
- Geolocate endpoint validates `x-forwarded-for` IP before upstream request
- Health endpoint returns minimal info (no uptime/timestamp)

### Cache strategy
30-second TTL `node-cache` for API responses. No cross-process cache invalidation — each app's cache expires independently.

### Scheduler
Runs only in the web app. Every 6 hours: fetch from NSW Gov API → upsert stations + prices → detect availability changes. Weekly aggregation at 2 AM Sydney time.

### Mobile overlay z-index hierarchy
- `z-[1000]`: Base controls (SearchBar, FuelTypeSelector, Legend, LocateButton)
- `z-[1001]`: QuickFuelButton
- `z-[1002]`: Mobile backdrop dimmer
- `z-[1003]`: Panels (StationPanel, QuickFuelSheet) — mutually exclusive
- `z-[1004]`: System overlays (loading, errors)
- `z-[2000]`: Onboarding modal

### Advertising and subscriptions
- **Web**: Ads always show, no removal option. `adsRemoved` is always `false`.
- **Native (iOS/Android)**: Ads show by default. RevenueCat in-app subscription ($1/mo) removes ads. No backend subscriber tracking — RevenueCat is source of truth.

### User preferences
`src/lib/preferences.ts` stores in localStorage: selected fuel type (default `E10`), last map position, onboarding state.

### Navigate to cheapest
`QuickFuelButton` → locate user → `/api/fuel/stations/nearest` → `QuickFuelSheet` bottom sheet. Opens Apple Maps on iOS, Google Maps on Android/web. Uses `userPosition` (GPS/IP) first, falls back to `searchedLocation` (postcode/suburb from search bar) if no GPS available. Only prompts for geolocation if neither is set.

## Deployment

### Production environment

- **Hosting**: Ubuntu VPS at `150.107.73.209`
- **Management**: Dokploy (connects to VPS as remote server)
- **Reverse proxy**: Traefik (via Dokploy agent)
- **Domain setup**: See `docs/domain-setup.md`

### Docker build

- **Dockerfile**: `apps/web/Dockerfile`, build context must be repo root
- **Multi-stage**: `node:22-slim` builder → minimal runtime image
- **Output**: Port 3000, runs `node build`
- **Healthcheck**: Uses `node -e "fetch(...)"` (no curl in slim image)

### Dokploy configuration

| Setting | Value |
|---|---|
| Root Directory | `/` |
| Dockerfile Path | `apps/web/Dockerfile` |
| Ingress Port | `3000` (TCP) |

### Environment variables (set in Dokploy)

```
NSW_FUEL_KEY=<api_key>
NSW_FUEL_SECRET=<api_secret>
ADMIN_TOKEN=<admin_token>
DATA_DIR=/app/data
ORIGIN=https://yourdomain.com.au
CORS_ORIGINS=https://yourdomain.com.au
```

### Persistent storage

- **Host path**: `/home/data/fuelnsw` → **Container path**: `/app/data`
- **Ownership**: UID `1000` (`node` user): `sudo chown -R 1000:1000 /home/data/fuelnsw`

### Capacitor native app

WebView shells loading the production web server directly. No bundled frontend — content updates are immediate.

## Gotchas

1. **`DATA_DIR` resolution** — Lazy on first `getDb()` call, not at import time. Defaults to `process.cwd()/data`.

2. **Vite cwd in workspaces** — Vite sets `process.cwd()` to `apps/web/`, so relative `.env` paths must be from there (e.g. `../../data`).

3. **`hist_` station matching** — History API matches `hist_` stations to live ones via `LOWER(name)`. Fragile if station names change.

4. **Dashboard regions query** — Uses two separate queries instead of a triple JOIN on 190K+ rows (old join caused 90s+ response times).

5. **Prepared statement caching** — History API caches statements by key. Keys must be unique per SQL string. Cache is capped at 32 entries with LRU eviction.

6. **`brand_group` not in schema.ts** — The `brand_group` column and dashboard tables exist in production but were created by migration scripts, not `initializeSchema()`.

7. **`onMount` async cleanup** — Svelte 5 `onMount` doesn't support async cleanup. Map init wraps async work in an IIFE inside synchronous `onMount`.

8. **Nearest stations radius** — Queries `limit*50` rows by price ASC, then filters to 20km. Intentional — distance-first would return nearby expensive stations.

9. **`@fuelnsw/shared` resolution** — Source lives under `packages/shared/src/` but the workspace symlink resolves to `packages/shared/`. Vite's alias in `vite.config.ts` maps to `src/`, while TypeScript needs `paths` in both apps' `tsconfig.json` and `exports` in the shared `package.json` to resolve sub-path imports like `@fuelnsw/shared/db/client`.

10. **`adsRemoved` on web** — Hardcoded `false` in `+layout.svelte`. Only read from localStorage on native.

11. **`better-sqlite3` must be in web `package.json`** — `adapter-node` only externalizes packages in web's own `dependencies`. If transitive only, Rollup bundles it and crashes with `__filename is not defined`.

12. **All Capacitor packages in web `package.json`** — Needed at build time even though guarded by `Capacitor.isNativePlatform()` at runtime.

13. **npm workspace hoisting** — Dependencies installed at repo root `/app/node_modules`, not per-app. Dockerfile copies from root.
