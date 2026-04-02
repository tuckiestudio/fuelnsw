import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '@fuelnsw/shared/db/client';
import { upsertStations } from '@fuelnsw/shared/db/stations';
import { savePricesAndSnapshot, getLatestRefreshTime } from '@fuelnsw/shared/db/prices';
import { seedMockData } from '@fuelnsw/shared/db/mock-data';
import { FUEL_TYPE_MAP } from '@fuelnsw/shared/api/types';
import { parseAddress } from '@fuelnsw/shared/utils/parse-address';
import { snapshotFuelAvailability, detectAndRecordChanges, backfillFromStaleRecords } from '@fuelnsw/shared/db/availability';
import 'dotenv/config';

function checkAuth(request: Request): boolean {
	const adminToken = process.env.ADMIN_TOKEN;
	if (!adminToken) return false;
	const auth = request.headers.get('authorization');
	if (!auth) return false;
	const parts = auth.split(' ');
	if (parts.length !== 2 || parts[0] !== 'Bearer') return false;
	const a = Buffer.from(parts[1]);
	const b = Buffer.from(adminToken);
	return a.length === b.length && timingSafeEqual(a, b);
}

export const POST: RequestHandler = async ({ request }) => {
	if (!checkAuth(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const COOLDOWN_MS = parseInt(process.env.COOLDOWN_MS || '', 10) || 5 * 60 * 1000;

	const lastRefresh = getLatestRefreshTime();
	if (lastRefresh) {
		const lastTime = new Date(lastRefresh).getTime();
		if (lastTime > Date.now() - COOLDOWN_MS) {
			return json({
				status: 'skipped',
				message: 'Refreshed recently, skipping to conserve API calls',
				lastRefresh
			});
		}
	}

	// Try the live API
	try {
		const { getAllPrices } = await import('@fuelnsw/shared/api/nsw-fuel-client');
		const data = await getAllPrices();

		const beforeSnapshot = snapshotFuelAvailability();

		upsertStations(data.stations.map(s => {
			const { suburb, state, postcode } = parseAddress(s.address);
			return {
				code: s.code,
				name: s.name,
				brand: s.brand,
				address: s.address,
				suburb,
				state,
				postcode,
				latitude: s.location.latitude,
				longitude: s.location.longitude
			};
		}));

		savePricesAndSnapshot(data.prices.map(p => ({
			stationcode: p.stationcode,
			fueltype: FUEL_TYPE_MAP[p.fueltype] || p.fueltype,
			price: p.price,
			lastupdated: p.lastupdated
		})));

		const db = getDb();
		db.prepare("INSERT INTO refresh_log (stations_count, prices_count) VALUES (?, ?)")
			.run(data.stations.length, data.prices.length);

		const refreshRow = db.prepare('SELECT id FROM refresh_log ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined;
		const refreshId = refreshRow?.id ?? 0;

		const afterSnapshot = snapshotFuelAvailability();
		const changes = detectAndRecordChanges(beforeSnapshot, afterSnapshot, refreshId);

		backfillFromStaleRecords();

		return json({
			status: 'success',
			stations: data.stations.length,
			prices: data.prices.length,
			source: 'live_api',
			availabilityChanges: changes
		});
	} catch (apiError) {
		console.warn('Live API failed, falling back to cached data:', apiError);

		const db = getDb();
		const existingStations = (db.prepare('SELECT COUNT(*) as c FROM stations').get() as { c: number }).c;
		if (existingStations > 0) {
			return json({
				status: 'cached',
				message: 'Using cached data (live API unavailable)',
				stations: existingStations,
				source: 'cache'
			});
		}

		try {
			seedMockData();
			const stations = (db.prepare('SELECT COUNT(*) as c FROM stations').get() as { c: number }).c;
			const prices = (db.prepare('SELECT COUNT(*) as c FROM live_prices').get() as { c: number }).c;
			return json({
				status: 'mock',
				message: 'Using mock data (live API unavailable — set NSW_FUEL_KEY and NSW_FUEL_SECRET in .env)',
				stations,
				prices,
				source: 'mock'
			});
		} catch (mockError) {
			return json({
				status: 'error',
				message: 'Data refresh failed. Check server logs for details.'
			}, { status: 500 });
		}
	}
};

export const GET: RequestHandler = async ({ request }) => {
	if (!checkAuth(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const db = getDb();
	const logs = db.prepare('SELECT * FROM refresh_log ORDER BY id DESC LIMIT 10').all();
	return json(logs);
};
