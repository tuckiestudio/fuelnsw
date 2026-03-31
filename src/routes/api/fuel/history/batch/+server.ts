import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getHistoricalPrices } from '$lib/db/prices';

export const GET: RequestHandler = async ({ url }) => {
	const station = url.searchParams.get('station');
	if (!station) {
		return json({ error: 'station parameter is required' }, { status: 400 });
	}

	const from = url.searchParams.get('from') || undefined;
	const to = url.searchParams.get('to') || undefined;

	const allPrices = getHistoricalPrices(station, undefined, from, to);

	const byFuelType: Record<string, Array<{ price_updated: string; price: number }>> = {};
	for (const p of allPrices) {
		if (!byFuelType[p.fuel_type]) byFuelType[p.fuel_type] = [];
		byFuelType[p.fuel_type].push({ price_updated: p.price_updated, price: p.price });
	}

	return json(byFuelType);
};
