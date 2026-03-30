import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStation } from '$lib/db/stations';
import { getLivePriceForStation } from '$lib/db/prices';

export const GET: RequestHandler = async ({ params }) => {
	const station = getStation(params.code);
	if (!station) {
		return json({ error: 'Station not found' }, { status: 404 });
	}

	const prices = getLivePriceForStation(params.code);
	return json({ station, prices });
};
