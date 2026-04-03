import { getLatestRefreshTime, savePricesAndSnapshot } from './db/prices.js';
import { upsertStations, getStationsNeedingHoursEnrichment, updateStationOpeningHours } from './db/stations.js';
import { getDb } from './db/client.js';
import { FUEL_TYPE_MAP } from './api/types.js';
import { parseAddress } from './utils/parse-address.js';
import { snapshotFuelAvailability, detectAndRecordChanges, backfillFromStaleRecords } from './db/availability.js';
import { scheduleNightlyAggregation } from './db/weekly-aggregation.js';
import { fetchOpeningHoursForStation } from './api/google-places-client.js';
import 'dotenv/config';

const REFRESH_INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL_MS || '', 10) || 6 * 60 * 60 * 1000;
const COOLDOWN_MS = parseInt(process.env.COOLDOWN_MS || '', 10) || 5 * 60 * 1000;

	const HOURS_ENRICHMENT_DELAY_MS = 200;

async function enrichOpeningHours(): Promise<void> {
	if (!process.env.GOOGLE_PLACES_API_KEY) return;

	const stations = getStationsNeedingHoursEnrichment();
	if (stations.length === 0) return;

	console.log(`[scheduler] Enriching opening hours for ${stations.length} stations...`);
	let updated = 0;

	for (const station of stations) {
		try {
			const hours = await fetchOpeningHoursForStation(
				station.name,
				station.address,
				station.latitude,
				station.longitude
			);
			updateStationOpeningHours(station.code, hours ? JSON.stringify(hours) : null);
			if (hours) updated++;
			await new Promise(r => setTimeout(r, HOURS_ENRICHMENT_DELAY_MS));
		} catch (err) {
			console.error(`[scheduler] Failed to enrich hours for ${station.code}:`, err instanceof Error ? err.message : err);
		}
	}

	console.log(`[scheduler] Opening hours enrichment complete — ${updated}/${stations.length} updated`);
}

async function runRefresh(): Promise<void> {
	const lastRefresh = getLatestRefreshTime();
	if (lastRefresh) {
		const elapsed = Date.now() - new Date(lastRefresh).getTime();
		if (elapsed < COOLDOWN_MS) {
			console.log(`[scheduler] Skipping refresh - last refresh was ${Math.floor(elapsed / 60000)} minutes ago (cooldown: ${COOLDOWN_MS / 60000} minutes)`);
			return;
		}
	}

	console.log('[scheduler] Starting data refresh...');

	try {
		const { getAllPrices } = await import('./api/nsw-fuel-client.js');
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

		console.log(`[scheduler] Refresh complete — ${data.stations.length} stations, ${data.prices.length} prices, availability changes: ${changes.dropped} dropped, ${changes.added} added`);

		enrichOpeningHours().catch(err => {
			console.error('[scheduler] Opening hours enrichment failed:', err instanceof Error ? err.message : err);
		});
	} catch (err) {
		console.error('[scheduler] Refresh failed:', err instanceof Error ? err.message : err);
	}
}

export function startScheduler(): void {
	setTimeout(() => {
		runRefresh();
	}, 30_000);

	setInterval(() => {
		runRefresh();
	}, REFRESH_INTERVAL_MS);

	console.log(`[scheduler] Price auto-refresh enabled — every ${REFRESH_INTERVAL_MS / 1000 / 60 / 60} hours`);

	scheduleNightlyAggregation();
	console.log('[scheduler] Weekly aggregation scheduled for 2 AM Sydney time');
}
