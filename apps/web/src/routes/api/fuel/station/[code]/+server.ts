import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStation } from '@fuelnsw/shared/db/stations';
import { getLivePriceForStation } from '@fuelnsw/shared/db/prices';
import { isOpenNow } from '@fuelnsw/shared/api/google-places-client';
import type { OpeningHours } from '@fuelnsw/shared/api/types';

export const GET: RequestHandler = async ({ params }) => {
	const station = getStation(params.code);
	if (!station) {
		return json({ error: 'Station not found' }, { status: 404 });
	}

	const prices = getLivePriceForStation(params.code);
	let is_open = true;
	if (station.opening_hours) {
		try {
			is_open = isOpenNow(JSON.parse(station.opening_hours) as OpeningHours);
		} catch {}
	}
	return json({ station, prices, is_open });
};
