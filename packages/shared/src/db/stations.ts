import { getDb } from './client.js';
import type { Station, StationGeoJSON, OpeningHours } from '../api/types.js';
import { isOpenNow } from '../api/google-places-client.js';

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
	opening_hours: string | null;
	price_value: number | null;
	price_fuel_type: string | null;
}

function computeIsOpen(openingHoursJson: string | null): boolean {
	if (!openingHoursJson) return true;
	try {
		const hours = JSON.parse(openingHoursJson) as OpeningHours;
		return isOpenNow(hours);
	} catch {
		return true;
	}
}

export function getStationsAsGeoJSON(openOnly?: boolean): StationGeoJSON[] {
	return buildGeoJSON(getAllStationsWithPrices(), openOnly);
}

export function getStationsInBoundsAsGeoJSON(
	south: number, west: number, north: number, east: number,
	fuelType?: string,
	openOnly?: boolean
): StationGeoJSON[] {
	const db = getDb();

	if (!fuelType) {
		return buildGeoJSON(getAllStationsWithPricesInBounds(south, west, north, east), openOnly);
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

	return buildGeoJSON(rows, openOnly);
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

function buildGeoJSON(rows: StationPriceRow[], openOnly?: boolean): StationGeoJSON[] {
	const stationMap = new Map<string, StationGeoJSON>();
	for (const row of rows) {
		if (!stationMap.has(row.code)) {
			const isOpen = computeIsOpen(row.opening_hours);
			if (openOnly && !isOpen) continue;

			stationMap.set(row.code, {
				type: 'Feature',
				properties: {
					code: row.code,
					name: row.name,
					brand: row.brand,
					suburb: row.suburb,
					address: row.address,
					postcode: row.postcode,
					opening_hours: row.opening_hours,
					is_open: isOpen
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

export interface NearestStation {
	code: string;
	name: string;
	brand: string;
	suburb: string;
	address: string;
	postcode: string;
	latitude: number;
	longitude: number;
	price: number;
	distance_km: number;
	drive_minutes: number;
	opening_hours: string | null;
	is_open: boolean;
}

export function getNearestStationsByPrice(
	lat: number,
	lng: number,
	fuelType: string,
	limit = 10,
	radius = 20,
	openOnly = false
): NearestStation[] {
	const db = getDb();
	const queryLimit = Math.max(limit * 50, 500);
	const rows = db.prepare(`
		SELECT
			s.code,
			s.name,
			s.brand,
			s.suburb,
			s.address,
			s.postcode,
			s.latitude,
			s.longitude,
			s.opening_hours,
			lp.price,
			(6371 * acos(
				MIN(1, cos(radians(?)) * cos(radians(s.latitude)) *
				cos(radians(s.longitude) - radians(?)) +
				sin(radians(?)) * sin(radians(s.latitude)))
			)) AS distance_km
		FROM stations s
		JOIN live_prices lp ON lp.station_code = s.code
		WHERE lp.fuel_type = ?
		  AND lp.price IS NOT NULL
		  AND s.latitude IS NOT NULL
		  AND s.longitude IS NOT NULL
		ORDER BY lp.price ASC
		LIMIT ?
	`).all(lat, lng, lat, fuelType, queryLimit) as (Omit<NearestStation, 'drive_minutes' | 'is_open'> & { distance_km: number })[];

	return rows
		.map(r => ({
			...r,
			is_open: computeIsOpen(r.opening_hours),
			drive_minutes: Math.round(r.distance_km / 0.5)
		}))
		.filter(r => !openOnly || r.is_open)
		.filter(r => r.distance_km <= radius)
		.slice(0, limit);
}

export function getStationsNeedingHoursEnrichment(limit = 500): Array<{
	code: string;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
}> {
	const db = getDb();
	return db.prepare(`
		SELECT code, name, address, latitude, longitude
		FROM stations
		WHERE opening_hours IS NULL
		   OR hours_last_fetched IS NULL
		ORDER BY code
		LIMIT ?
	`).all(limit) as Array<{
		code: string;
		name: string;
		address: string;
		latitude: number;
		longitude: number;
	}>;
}

export function getAllStationsForHoursRefresh(): Array<{
	code: string;
	name: string;
	address: string;
	latitude: number;
	longitude: number;
}> {
	const db = getDb();
	return db.prepare(`
		SELECT code, name, address, latitude, longitude
		FROM stations
		ORDER BY code
	`).all() as Array<{
		code: string;
		name: string;
		address: string;
		latitude: number;
		longitude: number;
	}>;
}

export function clearAllOpeningHours(): void {
	const db = getDb();
	db.prepare(`UPDATE stations SET opening_hours = NULL, hours_last_fetched = NULL`).run();
}

export function updateStationOpeningHours(code: string, hoursJson: string | null): void {
	const db = getDb();
	db.prepare(`
		UPDATE stations
		SET opening_hours = ?,
		    hours_last_fetched = datetime('now')
		WHERE code = ?
	`).run(hoursJson, code);
}
