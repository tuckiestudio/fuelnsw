import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLivePrices } from '$lib/db/prices';

export const GET: RequestHandler = async () => {
	const prices = getLivePrices();
	return json(prices);
};
