import Database from 'better-sqlite3';
import { getDb } from './client.js';
import type { LivePrice, HistoricalPrice } from '../api/types.js';
import { sydneyDate } from '../utils/date.js';
import { FUEL_TYPE_MAP, REVERSE_FUEL_MAP } from '../utils/fuel-types.js';

const UPSERT_LIVE_PRICE = `
	INSERT INTO live_prices (station_code, fuel_type, price, last_updated, fetched_at)
	VALUES (?, ?, ?, ?, datetime('now'))
	ON CONFLICT(station_code, fuel_type) DO UPDATE SET
		price = excluded.price,
		last_updated = excluded.last_updated,
		fetched_at = datetime('now')
`;

const UPSERT_HISTORICAL = `
	INSERT INTO historical_prices (station_code, fuel_type, price, price_updated)
	VALUES (?, ?, ?, ?)
	ON CONFLICT(station_code, fuel_type, price_updated) DO UPDATE SET
		price = excluded.price
`;

const UPSERT_FUEL_INVENTORY = `
	INSERT INTO station_fuel_inventory (station_code, fuel_type, first_seen, last_seen, total_records)
	VALUES (?, ?, ?, ?, 1)
	ON CONFLICT(station_code, fuel_type) DO UPDATE SET
		last_seen = excluded.last_seen,
		total_records = total_records + 1
`;

export function savePricesAndSnapshot(prices: Array<{
	stationcode: string;
	fueltype: string;
	price: number;
	lastupdated: string;
}>): void {
	const db = getDb();
	const today = sydneyDate();

	const liveStmt = db.prepare(UPSERT_LIVE_PRICE);
	const histStmt = db.prepare(UPSERT_HISTORICAL);
	const invStmt = db.prepare(UPSERT_FUEL_INVENTORY);

	const transaction = db.transaction((items: typeof prices) => {
		for (const p of items) {
			const normalizedFuel = FUEL_TYPE_MAP[p.fueltype] || p.fueltype;
			liveStmt.run(p.stationcode, normalizedFuel, p.price, p.lastupdated);
			histStmt.run(p.stationcode, normalizedFuel, p.price, today);
			invStmt.run(p.stationcode, normalizedFuel, today, today);
		}
	});

	transaction(prices);
}

export function getLivePrices(): LivePrice[] {
	const db = getDb();
	return db.prepare('SELECT * FROM live_prices ORDER BY station_code, fuel_type').all() as LivePrice[];
}

export function getLivePriceForStation(stationCode: string): LivePrice[] {
	const db = getDb();
	return db.prepare('SELECT * FROM live_prices WHERE station_code = ? ORDER BY fuel_type').all(stationCode) as LivePrice[];
}

export function getHistoricalPrices(
	stationCode: string,
	fuelType?: string,
	from?: string,
	to?: string
): HistoricalPrice[] {
	const db = getDb();

	const historicalFuelType = fuelType ? (REVERSE_FUEL_MAP[fuelType] || fuelType) : undefined;

	const results: HistoricalPrice[] = [];
	const seen = new Set<string>();

	const addResults = (rows: HistoricalPrice[]) => {
		for (const row of rows) {
			const key = `${row.station_code}|${row.fuel_type}|${row.price_updated}`;
			if (!seen.has(key)) {
				seen.add(key);
				results.push(row);
			}
		}
	};

	if (/^\d+$/.test(stationCode) && fuelType) {
		const liveHistorical = queryHistoricalPrices(db, stationCode, fuelType, from, to);
		addResults(liveHistorical);
	}

	if (/^\d+$/.test(stationCode)) {
		const station = db
			.prepare('SELECT name FROM stations WHERE code = ?')
			.get(stationCode) as { name: string } | undefined;
		if (station) {
			const histStation = db
				.prepare("SELECT code FROM stations WHERE LOWER(name) = LOWER(?) AND code LIKE 'hist_%' LIMIT 1")
				.get(station.name) as { code: string } | undefined;
			if (histStation) {
				const histData = queryHistoricalPrices(db, histStation.code, historicalFuelType, from, to);
				addResults(histData);
				
				if (historicalFuelType !== fuelType && fuelType) {
					const histData2 = queryHistoricalPrices(db, histStation.code, fuelType, from, to);
					addResults(histData2);
				}
			}
		}
	}

	if (results.length === 0 && /^\d+$/.test(stationCode) && fuelType && historicalFuelType !== fuelType) {
		const liveHistorical = queryHistoricalPrices(db, stationCode, historicalFuelType, from, to);
		addResults(liveHistorical);
	}

	results.sort((a, b) => a.price_updated.localeCompare(b.price_updated));

	if (/^\d+$/.test(stationCode) && fuelType) {
		const live = db
			.prepare('SELECT price, last_updated FROM live_prices WHERE station_code = ? AND fuel_type = ?')
			.get(stationCode, fuelType) as { price: number; last_updated: string } | undefined;
		if (live && live.price != null) {
			const today = sydneyDate();
			const lastHistDate = results.length > 0 ? results[results.length - 1].price_updated : '';
			if (today >= lastHistDate) {
				const hasToday = results.some(r => r.price_updated === today);
				if (!hasToday) {
					results.push({
						station_code: stationCode,
						fuel_type: fuelType,
						price: live.price,
						price_updated: today
					});
				}
			}
		}
	}

	return results;
}

function queryHistoricalPrices(
	db: Database.Database,
	stationCode: string,
	fuelType?: string,
	from?: string,
	to?: string
): HistoricalPrice[] {
	let query = 'SELECT * FROM historical_prices WHERE station_code = ?';
	const params: (string | number)[] = [stationCode];

	if (fuelType) {
		query += ' AND fuel_type = ?';
		params.push(fuelType);
	}
	if (from) {
		query += ' AND price_updated >= ?';
		params.push(from);
	}
	if (to) {
		query += ' AND price_updated <= ?';
		params.push(to);
	}

	query += ' ORDER BY price_updated ASC';
	return db.prepare(query).all(...params) as HistoricalPrice[];
}

export function getLatestRefreshTime(): string | null {
	const db = getDb();
	const row = db.prepare('SELECT fetched_at FROM refresh_log ORDER BY id DESC LIMIT 1').get() as { fetched_at: string } | undefined;
	return row?.fetched_at ?? null;
}
