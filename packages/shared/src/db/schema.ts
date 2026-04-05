import { getDb } from './client.js';

export function initializeSchema(): void {
	const db = getDb();

	db.exec(`
		CREATE TABLE IF NOT EXISTS stations (
			code TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			brand TEXT,
			address TEXT,
			suburb TEXT,
			state TEXT DEFAULT 'NSW',
			postcode TEXT,
			latitude REAL NOT NULL,
			longitude REAL NOT NULL,
			last_seen TEXT DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS live_prices (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			station_code TEXT NOT NULL REFERENCES stations(code),
			fuel_type TEXT NOT NULL,
			price REAL,
			last_updated TEXT,
			fetched_at TEXT DEFAULT (datetime('now')),
			UNIQUE(station_code, fuel_type)
		);

		CREATE TABLE IF NOT EXISTS historical_prices (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			station_code TEXT NOT NULL REFERENCES stations(code),
			fuel_type TEXT NOT NULL,
			price REAL NOT NULL,
			price_updated TEXT NOT NULL,
			UNIQUE(station_code, fuel_type, price_updated)
		);

		CREATE INDEX IF NOT EXISTS idx_historical_station_fuel
			ON historical_prices(station_code, fuel_type, price_updated);

		CREATE TABLE IF NOT EXISTS station_fuel_inventory (
			station_code TEXT NOT NULL REFERENCES stations(code),
			fuel_type TEXT NOT NULL,
			first_seen TEXT NOT NULL,
			last_seen TEXT NOT NULL,
			total_records INTEGER DEFAULT 0,
			PRIMARY KEY (station_code, fuel_type)
		);

		CREATE TABLE IF NOT EXISTS refresh_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			fetched_at TEXT DEFAULT (datetime('now')),
			stations_count INTEGER,
			prices_count INTEGER
		);

		CREATE TABLE IF NOT EXISTS fuel_availability_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			station_code TEXT NOT NULL REFERENCES stations(code),
			fuel_type TEXT NOT NULL,
			event_type TEXT NOT NULL CHECK(event_type IN ('dropped', 'added')),
			detected_at TEXT NOT NULL DEFAULT (datetime('now')),
			previous_price REAL,
			refresh_id INTEGER REFERENCES refresh_log(id)
		);

		CREATE INDEX IF NOT EXISTS idx_events_type_date
			ON fuel_availability_events(event_type, detected_at);

		CREATE INDEX IF NOT EXISTS idx_events_station_fuel
			ON fuel_availability_events(station_code, fuel_type);

		CREATE TABLE IF NOT EXISTS daily_snapshots (
			snapshot_date TEXT NOT NULL,
			station_code TEXT NOT NULL REFERENCES stations(code),
			fuel_type TEXT NOT NULL,
			price REAL NOT NULL,
			PRIMARY KEY (snapshot_date, station_code, fuel_type)
		);

		CREATE INDEX IF NOT EXISTS idx_snapshots_date
			ON daily_snapshots(snapshot_date);

		CREATE TABLE IF NOT EXISTS pending_drops (
			station_code TEXT NOT NULL,
			fuel_type TEXT NOT NULL,
			miss_count INTEGER DEFAULT 1,
			first_missing_at TEXT DEFAULT (datetime('now')),
			last_missing_at TEXT DEFAULT (datetime('now')),
			previous_price REAL,
			PRIMARY KEY (station_code, fuel_type)
		);

		CREATE INDEX IF NOT EXISTS idx_pending_drops_miss_count
			ON pending_drops(miss_count);

		CREATE TABLE IF NOT EXISTS hours_suggestions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			station_code TEXT NOT NULL REFERENCES stations(code),
			opening_hours TEXT NOT NULL,
			submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
			status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected'))
		);

		CREATE INDEX IF NOT EXISTS idx_hours_suggestions_status
			ON hours_suggestions(status, submitted_at DESC);

		CREATE INDEX IF NOT EXISTS idx_hours_suggestions_station
			ON hours_suggestions(station_code, status);
	`);

	const tableInfo = db.prepare("PRAGMA table_info(stations)").all() as { name: string }[];
	const columns = tableInfo.map(c => c.name);
	if (!columns.includes('opening_hours')) {
		db.exec("ALTER TABLE stations ADD COLUMN opening_hours TEXT");
	}
	if (!columns.includes('hours_last_fetched')) {
		db.exec("ALTER TABLE stations ADD COLUMN hours_last_fetched TEXT");
	}
	if (!columns.includes('hours_fetch_status')) {
		db.exec("ALTER TABLE stations ADD COLUMN hours_fetch_status TEXT CHECK(hours_fetch_status IN ('found', 'not_found'))");
	}
	if (!columns.includes('brand_group')) {
		db.exec("ALTER TABLE stations ADD COLUMN brand_group TEXT");
	}
}
