import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getHistoricalPrices } from '$lib/db/prices';

export const GET: RequestHandler = async ({ url }) => {
	const station = url.searchParams.get('station');
	const fuelType = url.searchParams.get('fuel') || undefined;
	const from = url.searchParams.get('from') || undefined;
	const to = url.searchParams.get('to') || undefined;

	if (!station) {
		return json({ error: 'station parameter is required' }, { status: 400 });
	}

	const prices = getHistoricalPrices(station, fuelType, from, to);
	return json(prices);
};
