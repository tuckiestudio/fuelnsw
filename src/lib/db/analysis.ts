import { getDb } from './client.js';

interface HistRow {
	fuel_type: string;
	avg_price: number;
	min_price: number;
	max_price: number;
	days: number;
}

interface CountRow {
	c: number;
}

interface AvgRow {
	fuel_type: string;
	avg_price: number;
}

export function getSummaryStats(): {
	totalStations: number;
	stationsWithPrices: number;
	totalPrices: number;
	avgPrices: Record<string, number>;
	historicalAvgPrices: Record<string, { avg: number; min: number; max: number; days: number }>;
	dryCount: number;
	offlineCount: number;
	lastRefresh: string | null;
} {
	const db = getDb();

	const totalStations = (db.prepare('SELECT COUNT(*) as c FROM stations').get() as CountRow).c;
	const stationsWithPrices = (db.prepare('SELECT COUNT(DISTINCT station_code) as c FROM live_prices WHERE price IS NOT NULL').get() as CountRow).c;
	const totalPrices = (db.prepare('SELECT COUNT(*) as c FROM live_prices WHERE price IS NOT NULL').get() as CountRow).c;

	const avgRows = db.prepare(`
		SELECT fuel_type, AVG(price) as avg_price
		FROM live_prices
		WHERE price IS NOT NULL
		GROUP BY fuel_type
		ORDER BY fuel_type
	`).all() as AvgRow[];

	const avgPrices: Record<string, number> = {};
	for (const row of avgRows) {
		avgPrices[row.fuel_type] = Math.round(row.avg_price * 10) / 10;
	}

	const histRows = db.prepare(`
		SELECT fuel_type,
			AVG(price) as avg_price,
			MIN(price) as min_price,
			MAX(price) as max_price,
			COUNT(DISTINCT price_updated) as days
		FROM historical_prices
		GROUP BY fuel_type
		ORDER BY fuel_type
	`).all() as HistRow[];

	const historicalAvgPrices: Record<string, { avg: number; min: number; max: number; days: number }> = {};
	for (const row of histRows) {
		historicalAvgPrices[row.fuel_type] = {
			avg: Math.round(row.avg_price * 10) / 10,
			min: Math.round(row.min_price * 10) / 10,
			max: Math.round(row.max_price * 10) / 10,
			days: row.days
		};
	}

	const dryCount = (db.prepare(`
		SELECT COUNT(*) as c FROM (
			WITH latest_events AS (
				SELECT
					station_code,
					fuel_type,
					event_type,
					ROW_NUMBER() OVER (PARTITION BY station_code, fuel_type ORDER BY detected_at DESC, id DESC) as rn
				FROM fuel_availability_events
			)
			SELECT station_code, fuel_type
			FROM latest_events
			WHERE rn = 1 AND event_type = 'dropped'
		)
	`).get() as CountRow).c;

	const offlineCount = (db.prepare(`
		SELECT COUNT(*) as c FROM (
			WITH latest_events AS (
				SELECT
					station_code,
					fuel_type,
					event_type,
					ROW_NUMBER() OVER (PARTITION BY station_code, fuel_type ORDER BY detected_at DESC, id DESC) as rn
				FROM fuel_availability_events
			),
			station_drops AS (
				SELECT station_code
				FROM latest_events
				WHERE rn = 1 AND event_type = 'dropped'
				GROUP BY station_code
			)
			SELECT sd.station_code
			FROM station_drops sd
			WHERE NOT EXISTS (
				SELECT 1 FROM live_prices lp
				WHERE lp.station_code = sd.station_code AND lp.price IS NOT NULL
			)
		)
	`).get() as CountRow).c;

	const refreshRow = db.prepare('SELECT fetched_at FROM refresh_log ORDER BY id DESC LIMIT 1').get() as { fetched_at: string } | undefined;
	const lastRefresh = refreshRow?.fetched_at ?? null;

	return { totalStations, stationsWithPrices, totalPrices, avgPrices, historicalAvgPrices, dryCount, offlineCount, lastRefresh };
}
