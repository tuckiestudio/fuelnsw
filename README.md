# FuelNSW

Real-time fuel price tracker for New South Wales, Australia. Live prices from the NSW Government Fuel Check API are displayed on an interactive map with colour-coded station markers, per-station price history charts, fuel type filtering, and dry station detection.

## Features

- **Interactive map** — Leaflet map with colour-coded markers (green = cheap, red = expensive) and postcode boundaries
- **Per-station price history** — Chart.js charts showing price trends for individual stations
- **Fuel type filtering** — Filter by E10, Unleaded, P95, P98, Diesel, LPG, and more
- **Summary dashboard** — Averages, historical comparisons, and fuel availability breakdown
- **Dry station detection** — Identifies stations that have dropped fuel types, with severity levels
- **Historical data import** — ~10 years of data from the Data.NSW open data portal
- **Auto-refresh** — Prices update every 6 hours via the NSW Fuel API
- **Offline resilience** — Falls back to cached or mock data if the API is unavailable

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 5 (Svelte 5 runes) with TypeScript |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Styling | Tailwind CSS 4 |
| Maps | Leaflet |
| Charts | Chart.js |
| Runtime | Node.js adapter (local SQLite, not serverless) |

## Quick Start

```sh
npm install
cp .env.example .env
# Edit .env with your NSW Fuel API credentials
npm run dev
```

Register for API keys at [api.nsw.gov.au](https://api.nsw.gov.au/).

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NSW_FUEL_KEY` | Yes | — | NSW Fuel Check API key |
| `NSW_FUEL_SECRET` | Yes | — | NSW Fuel Check API secret |
| `PORT` | No | `3000` | Server port |
| `ORIGIN` | No | — | Public URL (for SvelteKit) |
| `DATA_DIR` | No | `./data` | Directory for SQLite database |
| `SCHEDULER_INTERVAL_MS` | No | `21600000` | Auto-refresh interval (6 hours) |
| `COOLDOWN_MS` | No | `300000` | Minimum time between refreshes (5 min) |

## Scripts

```sh
npm run dev              # Development server
npm run build            # Production build
npm run preview          # Preview production build
npm run check            # TypeScript type checking
npm run import:history   # Import historical data from Data.NSW
```

## Project Structure

```
src/
  routes/
    +page.svelte                    # Map view
    +layout.svelte                  # App shell with navigation
    summary/+page.svelte            # Dashboard
    api/
      health/+server.ts             # Health check
      refresh/+server.ts            # Data refresh endpoint
      fuel/
        stations/+server.ts         # Stations GeoJSON
        prices/+server.ts           # Live prices
        history/+server.ts          # Historical prices
        station/[code]/+server.ts   # Single station detail
      dry-stations/+server.ts       # Dry station detection
      postcode-boundary/+server.ts  # Postcode boundary GeoJSON
  lib/
    api/                            # NSW Fuel API client + types
    db/                             # SQLite client, schema, queries
    utils/                          # Fuel types, geo utils, address parser
    scheduler.ts                    # Auto-refresh scheduler
  components/
    station/PriceChart.svelte       # Chart.js price history chart
  hooks.server.ts                   # Server startup (schema init, scheduler)
scripts/
  import-history.ts                 # Historical data importer
```

## Deployment

### Docker

```sh
docker build -t fuelnsw .
docker run -d \
  -p 3000:3000 \
  -e NSW_FUEL_KEY=your_key \
  -e NSW_FUEL_SECRET=your_secret \
  -v fuelnsw-data:/app/data \
  fuelnsw
```

### Dokploy / Coolify

1. Push your code to a Git repository
2. Create a new service pointing to your repo
3. Set environment variables: `NSW_FUEL_KEY`, `NSW_FUEL_SECRET`, `ORIGIN`
4. Deploy

The `data/` directory is mounted as a Docker volume so your SQLite database persists across container restarts.

## Data Sources

- **Live prices** — [NSW Fuel Check API](https://api.onegov.nsw.gov.au/) (OAuth2)
- **Historical data** — [Data.NSW CKAN](https://data.nsw.gov.au/) (public open data)

## License

MIT
