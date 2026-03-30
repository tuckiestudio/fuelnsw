# AusFuel — NSW Fuel Price Tracker

Real-time fuel price tracking for New South Wales, Australia. Fetches live prices from the NSW Government Fuel Check API, displays stations on an interactive map, tracks price history, and detects potentially dry stations.

## Features

- Interactive Leaflet map with color-coded station markers (green=cheap, red=expensive)
- Per-station price history charts (Chart.js)
- Fuel type filtering (E10, Unleaded, P95, P98, Diesel, LPG, etc.)
- Summary dashboard with averages, historical comparisons, and dry station detection
- Historical data import (~10 years) from Data.NSW open data portal
- Auto-refresh scheduler (every 6 hours via NSW Fuel API)
- Fallback to cached data or mock data if API is unavailable

## Tech Stack

- **SvelteKit 5** (Svelte 5 runes) with TypeScript
- **SQLite** via better-sqlite3 (WAL mode)
- **Tailwind CSS 4**
- **Leaflet** for maps, **Chart.js** for charts
- **Node.js** adapter (not serverless — uses local SQLite)

## Quick Start

```sh
npm install
cp .env.example .env
# Edit .env with your NSW Fuel API credentials
npm run dev
```

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

Register for API keys at [api.nsw.gov.au](https://api.nsw.gov.au/).

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
    +page.svelte              # Map view
    summary/+page.svelte      # Dashboard
    api/
      health/+server.ts       # Health check
      refresh/+server.ts      # Data refresh endpoint
      fuel/
        stations/+server.ts   # Stations GeoJSON
        prices/+server.ts     # Live prices
        history/+server.ts    # Historical prices
        station/[code]/       # Single station
      dry-stations/+server.ts # Dry station detection
  lib/
    api/                      # NSW Fuel API client + types
    db/                       # SQLite client, schema, queries
    utils/                    # Fuel types, geo utils, address parser
    scheduler.ts              # Auto-refresh scheduler
  components/
    station/PriceChart.svelte # Chart.js price history chart
scripts/
  import-history.ts           # Historical data importer
```

## Deploying to Dokploy

The included `Dockerfile` is ready for Dokploy:

1. Push your code to a Git repository
2. In Dokploy, create a new **Compose** service pointing to your repo
3. Set the following environment variables in Dokploy:
   - `NSW_FUEL_KEY`
   - `NSW_FUEL_SECRET`
   - `ORIGIN` (your public URL, e.g. `https://ausfuel.yourdomain.com`)
4. Deploy

The `data/` directory is mounted as a Docker volume, so your SQLite database persists across container restarts.

### Manual Docker Deployment

```sh
docker build -t ausfuel .
docker run -d \
  -p 3000:3000 \
  -e NSW_FUEL_KEY=your_key \
  -e NSW_FUEL_SECRET=your_secret \
  -v ausfuel-data:/app/data \
  ausfuel
```

## Data Sources

- **Live prices**: [NSW Fuel Check API](https://api.onegov.nsw.gov.au/) (OAuth2)
- **Historical data**: [Data.NSW CKAN](https://data.nsw.gov.au/) (public open data)
