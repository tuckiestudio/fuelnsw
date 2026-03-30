import { getLatestRefreshTime, savePricesAndSnapshot } from '$lib/db/prices';
import { upsertStations } from '$lib/db/stations';
import { getDb } from '$lib/db/client';
import { FUEL_TYPE_MAP } from '$lib/api/types';
import { parseAddress } from '$lib/utils/parse-address';

const REFRESH_INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL_MS || '', 10) || 6 * 60 * 60 * 1000;
const COOLDOWN_MS = parseInt(process.env.COOLDOWN_MS || '', 10) || 5 * 60 * 1000;

async function runRefresh(): Promise<void> {
	const lastRefresh = getLatestRefreshTime();
	if (lastRefresh) {
		const elapsed = Date.now() - new Date(lastRefresh).getTime();
		if (elapsed < COOLDOWN_MS) return;
	}

	try {
		const { getAllPrices } = await import('$lib/api/nsw-fuel-client');
		const data = await getAllPrices();

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

		console.log(`[scheduler] Refresh complete — ${data.stations.length} stations, ${data.prices.length} prices`);
	} catch (err) {
		console.error('[scheduler] Refresh failed:', err instanceof Error ? err.message : err);
	}
}

export function startScheduler(): void {
	// First refresh after 30s (let server settle)
	setTimeout(() => {
		runRefresh();
	}, 30_000);

	// Then every 6 hours
	setInterval(() => {
		runRefresh();
	}, REFRESH_INTERVAL_MS);

	console.log(`[scheduler] Price auto-refresh enabled — every ${REFRESH_INTERVAL_MS / 1000 / 60 / 60} hours`);
}
