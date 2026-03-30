import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStationsAsGeoJSON } from '$lib/db/stations';

export const GET: RequestHandler = async () => {
	const stations = getStationsAsGeoJSON();
	return json(stations);
};
