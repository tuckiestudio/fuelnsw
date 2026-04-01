import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '@fuelnsw/shared/db/client';

const FUEL_MAP: Record<string, string[]> = {
	'E10': ['E10'],
	'Unleaded': ['Unleaded', 'U91'],
	'P95': ['P95'],
	'P98': ['P98'],
	'Diesel': ['Diesel', 'DL'],
	'LPG': ['LPG'],
	'B20': ['B20'],
	'PDL': ['PDL'],
	'E85': ['E85'],
	'EV': ['EV']
};

const stmtCache = new Map<string, any>();

function getStmt(db: any, key: string, sql: string) {
	if (!stmtCache.has(key)) stmtCache.set(key, db.prepare(sql));
	return stmtCache.get(key);
}

export const GET: RequestHandler = async ({ url }) => {
	const station = url.searchParams.get('station');
	const fuelType = url.searchParams.get('fuel') || undefined;

	if (!station) {
		return json({ error: 'station parameter is required' }, { status: 400 });
	}

	try {
		const db = getDb();
		const fuelTypes = fuelType ? (FUEL_MAP[fuelType] || [fuelType]) : null;
		const oneYearAgo = new Date();
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
		const fromStr = oneYearAgo.toISOString().slice(0, 10);

		const stationCodes = [station];
		if (/^\d+$/.test(station)) {
			const s = getStmt(db, 'station_name', 'SELECT name FROM stations WHERE code = ?').get(station);
			if (s) {
				const h = getStmt(db, 'hist_match', "SELECT code FROM stations WHERE LOWER(name) = LOWER(?) AND code LIKE 'hist_%' LIMIT 1").get(s.name);
				if (h) stationCodes.push(h.code);
			}
		}

		const seen = new Set<string>();
		const results: Array<{ price_updated: string; price: number }> = [];

		for (const code of stationCodes) {
			if (!fuelTypes) continue;
			const ph = fuelTypes.map(() => '?').join(',');
			const sql = `SELECT MAX(price_updated) as price_updated, ROUND(AVG(price), 1) as price FROM historical_prices WHERE station_code = ? AND fuel_type IN (${ph}) AND price_updated >= ? GROUP BY strftime('%Y-%m', price_updated) ORDER BY price_updated ASC`;
			const rows = getStmt(db, `hist_${ph}`, sql).all(code, ...fuelTypes, fromStr) as Array<{ price_updated: string; price: number }>;
			for (const r of rows) {
				const month = r.price_updated.substring(0, 7);
				if (!seen.has(month)) {
					seen.add(month);
					results.push(r);
				}
			}
		}

		results.sort((a, b) => a.price_updated.localeCompare(b.price_updated));

		if (fuelType && /^\d+$/.test(station)) {
			const live = getStmt(db, 'live', 'SELECT price FROM live_prices WHERE station_code = ? AND fuel_type = ?').get(station, fuelType) as { price: number } | undefined;
			if (live && live.price != null) {
				const today = new Date().toISOString().slice(0, 10);
				const todayMonth = today.substring(0, 7);
				const lastMonth = results.length > 0 ? results[results.length - 1].price_updated.substring(0, 7) : '';
				if (todayMonth !== lastMonth) {
					results.push({ price_updated: today, price: Math.round(live.price * 10) / 10 });
				} else if (results.length > 0) {
					results[results.length - 1].price = Math.round(live.price * 10) / 10;
					results[results.length - 1].price_updated = today;
				}
			}
		}

		return json(results);
	} catch (err) {
		console.error('History API error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
