import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStation } from '@fuelnsw/shared/db/stations';
import { createSuggestion, hasPendingSuggestion } from '@fuelnsw/shared/db/hours-suggestions';

export const POST: RequestHandler = async ({ params, request }) => {
	const station = getStation(params.code);
	if (!station) {
		return json({ error: 'Station not found' }, { status: 404 });
	}

	if (station.opening_hours) {
		return json({ error: 'Station already has opening hours' }, { status: 400 });
	}

	if (hasPendingSuggestion(params.code)) {
		return json({ error: 'A suggestion is already pending for this station' }, { status: 409 });
	}

	let body: { periods?: unknown; weekdayText?: string[] };
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	if (!body.weekdayText || !Array.isArray(body.weekdayText) || body.weekdayText.length !== 7) {
		return json({ error: 'weekdayText must be an array of 7 strings' }, { status: 400 });
	}

	if (!Array.isArray(body.periods) || body.periods.length === 0) {
		return json({ error: 'periods must be a non-empty array' }, { status: 400 });
	}

	const id = createSuggestion(params.code, JSON.stringify({ periods: body.periods, weekdayText: body.weekdayText }));
	return json({ status: 'submitted', id });
};
