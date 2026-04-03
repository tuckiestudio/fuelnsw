import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStationsInBoundsAsGeoJSON } from '@fuelnsw/shared/db/stations';

function validateCoordinate(value: number, isLatitude: boolean): boolean {
	if (isNaN(value)) return false;
	if (isLatitude) {
		return value >= -90 && value <= 90;
	}
	return value >= -180 && value <= 180;
}

export const GET: RequestHandler = async ({ url }) => {
	const south = parseFloat(url.searchParams.get('south') || '');
	const west = parseFloat(url.searchParams.get('west') || '');
	const north = parseFloat(url.searchParams.get('north') || '');
	const east = parseFloat(url.searchParams.get('east') || '');
	const fuel = url.searchParams.get('fuel') || undefined;
	const openOnly = url.searchParams.get('open_only') !== 'false';

	if (!validateCoordinate(south, true) || !validateCoordinate(north, true) || 
	    !validateCoordinate(west, false) || !validateCoordinate(east, false)) {
		return json({ error: 'Invalid coordinates' }, { status: 400 });
	}

	if (south >= north || west >= east) {
		return json({ error: 'Invalid bounds: south must be < north and west must be < east' }, { status: 400 });
	}

	const stations = getStationsInBoundsAsGeoJSON(south, west, north, east, fuel, openOnly);
	return json(stations);
};
