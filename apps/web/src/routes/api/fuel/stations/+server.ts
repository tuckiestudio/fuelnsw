import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStationsAsGeoJSON } from '@fuelnsw/shared/db/stations';

export const GET: RequestHandler = async ({ url }) => {
	const openOnly = url.searchParams.get('open_only') !== 'false';
	const stations = getStationsAsGeoJSON(openOnly);
	return json(stations);
};
