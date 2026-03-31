import { getDb } from './client.js';
import type {
	AvailabilityEvent,
	DryStation,
	FuelTypeAvailability,
	AvailabilityTrendPoint,
	OfflineStation
} from '../api/types.js';

interface ComboRow {
	station_code: string;
	fuel_type: string;
}

interface PriceRow {
	station_code: string;
	fuel_type: string;
	price: number;
}

export function snapshotFuelAvailability(): Map<string, { price: number }> {
	const db = getDb();
	const rows = db.prepare(
		"SELECT station_code, fuel_type, price FROM live_prices WHERE price IS NOT NULL"
	).all() as PriceRow[];
	const map = new Map<string, { price: number }>();
	for (const r of rows) {
		map.set(`${r.station_code}|${r.fuel_type}`, { price: r.price });
	}
	return map;
}

export function detectAndRecordChanges(
	before: Map<string, { price: number }>,
	after: Map<string, { price: number }>,
	refreshId: number
): { dropped: number; added: number } {
	const db = getDb();
	const insertStmt = db.prepare(
		`INSERT INTO fuel_availability_events (station_code, fuel_type, event_type, detected_at, previous_price, refresh_id)
		 VALUES (?, ?, ?, datetime('now'), ?, ?)`
	);

	let dropped = 0;
	let added = 0;

	const tx = db.transaction(() => {
		for (const [key, val] of before) {
			if (!after.has(key)) {
				const [station_code, fuel_type] = key.split('|');
				insertStmt.run(station_code, fuel_type, 'dropped', val.price, refreshId);
				dropped++;
			}
		}
		for (const key of after.keys()) {
			if (!before.has(key)) {
				const [station_code, fuel_type] = key.split('|');
				insertStmt.run(station_code, fuel_type, 'added', null, refreshId);
				added++;
			}
		}
	});

	tx();
	return { dropped, added };
}

export function backfillFromStaleRecords(): number {
	const db = getDb();

	const latestRefresh = db.prepare(
		'SELECT fetched_at FROM live_prices ORDER BY fetched_at DESC LIMIT 1'
	).get() as { fetched_at: string } | undefined;

	if (!latestRefresh) return 0;

	const staleRows = db.prepare(
		`SELECT station_code, fuel_type, price, fetched_at
		 FROM live_prices
		 WHERE fetched_at < ?
		 ORDER BY fetched_at ASC`
	).all(latestRefresh.fetched_at) as Array<{
		station_code: string;
		fuel_type: string;
		price: number;
		fetched_at: string;
	}>;

	if (staleRows.length === 0) return 0;

	const hasExisting = (db.prepare('SELECT COUNT(*) as c FROM fuel_availability_events').get() as { c: number }).c;
	if (hasExisting > 0) return 0;

	const latestRefreshRow = db.prepare(
		'SELECT id FROM refresh_log ORDER BY id DESC LIMIT 1'
	).get() as { id: number } | undefined;
	const refreshId = latestRefreshRow?.id ?? 0;

	const insertStmt = db.prepare(
		`INSERT INTO fuel_availability_events (station_code, fuel_type, event_type, detected_at, previous_price, refresh_id)
		 VALUES (?, ?, 'dropped', ?, ?, ?)`
	);

	let count = 0;
	const tx = db.transaction(() => {
		for (const row of staleRows) {
			insertStmt.run(row.station_code, row.fuel_type, row.fetched_at, row.price, refreshId);
			count++;
		}
	});
	tx();

	return count;
}

export function getDryStations(fuelType?: string): DryStation[] {
	const db = getDb();

	let query = `
		WITH latest_events AS (
			SELECT
				station_code,
				fuel_type,
				event_type,
				detected_at,
				previous_price,
				ROW_NUMBER() OVER (PARTITION BY station_code, fuel_type ORDER BY detected_at DESC, id DESC) as rn
			FROM fuel_availability_events
		),
		dropped AS (
			SELECT
				e.station_code,
				e.fuel_type,
				e.detected_at as dropped_at,
				e.previous_price,
				ROUND((julianday('now') - julianday(e.detected_at)) * 24, 1) as hours_since_drop
			FROM latest_events e
			WHERE e.rn = 1 AND e.event_type = 'dropped'
		)
		SELECT
			d.station_code,
			s.name as station_name,
			s.brand,
			s.suburb,
			d.fuel_type,
			d.dropped_at,
			d.hours_since_drop,
			d.previous_price,
			CASE
				WHEN d.hours_since_drop < 24 THEN 'recent'
				WHEN d.hours_since_drop < 72 THEN 'warning'
				ELSE 'critical'
			END as severity,
			CASE
				WHEN NOT EXISTS (
					SELECT 1 FROM live_prices lp
					WHERE lp.station_code = d.station_code AND lp.price IS NOT NULL
				) THEN 1
				ELSE 0
			END as is_fully_offline
		FROM dropped d
		JOIN stations s ON d.station_code = s.code
	`;

	const params: (string | number)[] = [];
	if (fuelType) {
		query += ' WHERE d.fuel_type = ?';
		params.push(fuelType);
	}

	query += ' ORDER BY d.hours_since_drop DESC';

	return db.prepare(query).all(...params) as DryStation[];
}

export function getOfflineStations(): OfflineStation[] {
	const db = getDb();

	return db.prepare(`
		WITH latest_events AS (
			SELECT
				station_code,
				fuel_type,
				event_type,
				detected_at,
				ROW_NUMBER() OVER (PARTITION BY station_code, fuel_type ORDER BY detected_at DESC, id DESC) as rn
			FROM fuel_availability_events
		),
		station_drops AS (
			SELECT
				e.station_code,
				COUNT(*) as fuel_types_dropped,
				MAX(e.detected_at) as dropped_at,
				ROUND((julianday('now') - julianday(MAX(e.detected_at))) * 24, 1) as hours_since_drop
			FROM latest_events e
			WHERE e.rn = 1 AND e.event_type = 'dropped'
			GROUP BY e.station_code
		)
		SELECT
			sd.station_code,
			s.name as station_name,
			s.brand,
			s.suburb,
			sd.fuel_types_dropped,
			sd.dropped_at,
			sd.hours_since_drop
		FROM station_drops sd
		JOIN stations s ON sd.station_code = s.code
		WHERE NOT EXISTS (
			SELECT 1 FROM live_prices lp
			WHERE lp.station_code = sd.station_code AND lp.price IS NOT NULL
		)
		ORDER BY sd.hours_since_drop DESC
	`).all() as OfflineStation[];
}

export function getFuelTypeAvailability(): FuelTypeAvailability[] {
	const db = getDb();

	const activeRows = db.prepare(`
		SELECT fuel_type, COUNT(DISTINCT station_code) as active_count
		FROM live_prices
		WHERE price IS NOT NULL
		GROUP BY fuel_type
	`).all() as Array<{ fuel_type: string; active_count: number }>;

	const activeMap = new Map(activeRows.map(r => [r.fuel_type, r.active_count]));

	const dryRows = db.prepare(`
		WITH latest_events AS (
			SELECT
				station_code,
				fuel_type,
				event_type,
				ROW_NUMBER() OVER (PARTITION BY station_code, fuel_type ORDER BY detected_at DESC, id DESC) as rn
			FROM fuel_availability_events
		)
		SELECT fuel_type, COUNT(*) as dry_count
		FROM latest_events
		WHERE rn = 1 AND event_type = 'dropped'
		GROUP BY fuel_type
	`).all() as Array<{ fuel_type: string; dry_count: number }>;

	const recentRows = db.prepare(`
		SELECT fuel_type, COUNT(*) as recently_dropped_count
		FROM fuel_availability_events
		WHERE event_type = 'dropped'
		  AND detected_at >= datetime('now', '-48 hours')
		GROUP BY fuel_type
	`).all() as Array<{ fuel_type: string; recently_dropped_count: number }>;

	const allFuelTypes = new Set<string>([
		...activeMap.keys(),
		...dryRows.map(r => r.fuel_type)
	]);

	const dryMap = new Map(dryRows.map(r => [r.fuel_type, r.dry_count]));
	const recentMap = new Map(recentRows.map(r => [r.fuel_type, r.recently_dropped_count]));

	return Array.from(allFuelTypes).map(fuel_type => ({
		fuel_type,
		active_count: activeMap.get(fuel_type) ?? 0,
		dry_count: dryMap.get(fuel_type) ?? 0,
		recently_dropped_count: recentMap.get(fuel_type) ?? 0
	})).sort((a, b) => (b.active_count + b.dry_count) - (a.active_count + a.dry_count));
}

export function getAvailabilityTrend(days: number = 14): AvailabilityTrendPoint[] {
	const db = getDb();

	return db.prepare(`
		SELECT
			date(detected_at) as date,
			SUM(CASE WHEN event_type = 'added' THEN 1 ELSE 0 END) as added,
			SUM(CASE WHEN event_type = 'dropped' THEN 1 ELSE 0 END) as dropped
		FROM fuel_availability_events
		WHERE detected_at >= date('now', ? || ' days')
		GROUP BY date(detected_at)
		ORDER BY date ASC
	`).bind(`-${days}`).all() as AvailabilityTrendPoint[];
}
