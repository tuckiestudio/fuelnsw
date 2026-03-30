import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDryStations, getOfflineStations, getFuelTypeAvailability, getAvailabilityTrend } from '$lib/db/availability';
import { getSummaryStats } from '$lib/db/analysis';

export const GET: RequestHandler = async ({ url }) => {
	const fuelType = url.searchParams.get('fuel') || undefined;
	const includeTrend = url.searchParams.get('trend') === 'true';

	const dryStations = getDryStations(fuelType);
	const offlineStations = getOfflineStations();
	const fuelAvailability = getFuelTypeAvailability();
	const stats = getSummaryStats();
	const trend = includeTrend ? getAvailabilityTrend(14) : undefined;

	return json({
		dryStations,
		offlineStations,
		fuelAvailability,
		stats,
		trend
	});
};
