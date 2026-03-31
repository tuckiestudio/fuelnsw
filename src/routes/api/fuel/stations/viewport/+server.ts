import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStationsInBoundsAsGeoJSON } from '$lib/db/stations';

export const GET: RequestHandler = async ({ url }) => {
	const south = parseFloat(url.searchParams.get('south') || '');
	const west = parseFloat(url.searchParams.get('west') || '');
	const north = parseFloat(url.searchParams.get('north') || '');
	const east = parseFloat(url.searchParams.get('east') || '');
	const fuel = url.searchParams.get('fuel') || undefined;

	if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) {
		return json({ error: 'south, west, north, east query params required' }, { status: 400 });
	}

	const stations = getStationsInBoundsAsGeoJSON(south, west, north, east, fuel);
	return json(stations);
};
