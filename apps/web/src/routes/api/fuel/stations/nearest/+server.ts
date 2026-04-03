import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getNearestStationsByPrice } from '@fuelnsw/shared/db/stations';

export const GET: RequestHandler = async ({ url }) => {
	const lat = parseFloat(url.searchParams.get('lat') ?? '');
	const lng = parseFloat(url.searchParams.get('lng') ?? '');
	const fuel = url.searchParams.get('fuel') ?? 'E10';
	const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);
	const radius = parseInt(url.searchParams.get('radius') ?? '20', 10);
	const openOnly = url.searchParams.get('open_only') !== 'false';

	if (isNaN(lat) || isNaN(lng)) {
		return json({ error: 'lat and lng query parameters are required' }, { status: 400 });
	}

	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
		return json({ error: 'Invalid coordinates' }, { status: 400 });
	}

	const stations = getNearestStationsByPrice(lat, lng, fuel, Math.min(limit, 20), Math.min(radius, 20), openOnly);

	return json({ stations });
};
