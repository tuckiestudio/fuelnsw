import { getDb } from './client.js';
import type { Station, StationGeoJSON } from '../api/types.js';

const UPSERT_STATION = `
	INSERT INTO stations (code, name, brand, address, suburb, state, postcode, latitude, longitude, last_seen)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
	ON CONFLICT(code) DO UPDATE SET
		name = excluded.name,
		brand = excluded.brand,
		address = excluded.address,
		suburb = excluded.suburb,
		state = excluded.state,
		postcode = excluded.postcode,
		latitude = excluded.latitude,
		longitude = excluded.longitude,
		last_seen = datetime('now')
`;

export function upsertStations(stations: Array<{
	code: string; name: string; brand: string; address: string;
	suburb: string; state: string; postcode: string;
	latitude: number; longitude: number;
}>): void {
	const db = getDb();
	const stmt = db.prepare(UPSERT_STATION);
	const transaction = db.transaction((items: typeof stations) => {
		for (const s of items) {
			stmt.run(s.code, s.name, s.brand, s.address, s.suburb, s.state, s.postcode, s.latitude, s.longitude);
		}
	});
	transaction(stations);
}

export function getAllStations(): Station[] {
	const db = getDb();
	return db.prepare('SELECT * FROM stations ORDER BY suburb, name').all() as Station[];
}

export function getStation(code: string): Station | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM stations WHERE code = ?').get(code) as Station | undefined;
}

interface StationPriceRow {
	code: string;
	name: string;
	brand: string;
	address: string;
	suburb: string;
	postcode: string;
	latitude: number;
	longitude: number;
	price_value: number | null;
	price_fuel_type: string | null;
}

export function getStationsAsGeoJSON(): StationGeoJSON[] {
	return buildGeoJSON(getAllStationsWithPrices());
}

export function getStationsInBoundsAsGeoJSON(
	south: number, west: number, north: number, east: number,
	fuelType?: string
): StationGeoJSON[] {
	const db = getDb();

	if (!fuelType) {
		return buildGeoJSON(getAllStationsWithPricesInBounds(south, west, north, east));
	}

	const stationCodesWithFuel = db.prepare(`
		SELECT DISTINCT s.code
		FROM stations s
		INNER JOIN live_prices p ON s.code = p.station_code
		WHERE s.latitude >= ? AND s.latitude <= ? 
		  AND s.longitude >= ? AND s.longitude <= ?
		  AND p.fuel_type = ?
	`).all(south, north, west, east, fuelType) as { code: string }[];

	if (stationCodesWithFuel.length === 0) {
		return [];
	}

	const codes = stationCodesWithFuel.map(s => s.code);
	const placeholders = codes.map(() => '?').join(',');
	const rows = db.prepare(`
		SELECT s.*, p.price as price_value, p.fuel_type as price_fuel_type
		FROM stations s
		LEFT JOIN live_prices p ON s.code = p.station_code
		WHERE s.code IN (${placeholders})
		ORDER BY s.suburb, s.name
	`).all(...codes) as StationPriceRow[];

	return buildGeoJSON(rows);
}

interface StationPriceRow {
	code: string;
	name: string;
	brand: string;
	address: string;
	suburb: string;
	postcode: string;
	latitude: number;
	longitude: number;
	price_value: number | null;
	price_fuel_type: string | null;
}

function getAllStationsWithPrices(): StationPriceRow[] {
	const db = getDb();
	const query = `
		SELECT s.*, p.price as price_value, p.fuel_type as price_fuel_type
		FROM stations s
		LEFT JOIN live_prices p ON s.code = p.station_code
		ORDER BY s.suburb, s.name
	`;
	return db.prepare(query).all() as StationPriceRow[];
}

function getAllStationsWithPricesInBounds(
	south: number, west: number, north: number, east: number
): StationPriceRow[] {
	const db = getDb();
	const query = `
		SELECT s.*, p.price as price_value, p.fuel_type as price_fuel_type
		FROM stations s
		LEFT JOIN live_prices p ON s.code = p.station_code
		WHERE s.latitude >= ? AND s.latitude <= ? 
		  AND s.longitude >= ? AND s.longitude <= ?
		ORDER BY s.suburb, s.name
	`;
	return db.prepare(query).all(south, north, west, east) as StationPriceRow[];
}

function buildGeoJSON(rows: StationPriceRow[]): StationGeoJSON[] {
	const stationMap = new Map<string, StationGeoJSON>();
	for (const row of rows) {
		if (!stationMap.has(row.code)) {
			stationMap.set(row.code, {
				type: 'Feature',
				properties: {
					code: row.code,
					name: row.name,
					brand: row.brand,
					suburb: row.suburb,
					address: row.address,
					postcode: row.postcode
				},
				geometry: {
					type: 'Point',
					coordinates: [row.longitude, row.latitude]
				}
			});
		}
		if (row.price_fuel_type && row.price_value != null) {
			stationMap.get(row.code)!.properties[row.price_fuel_type] = String(row.price_value);
		}
	}

	return Array.from(stationMap.values());
}
