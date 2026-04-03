import type { OpeningHours } from './types.js';

const PLACES_API_BASE = 'https://places.googleapis.com/v1';

function getApiKey(): string {
	const key = process.env.GOOGLE_PLACES_API_KEY;
	if (!key) {
		throw new Error('GOOGLE_PLACES_API_KEY environment variable is required');
	}
	return key;
}

interface PlaceSearchResult {
	id: string;
	currentOpeningHours?: {
		openNow?: boolean;
		periods?: Array<{
			open: { day: number; time: string; hours?: number; minutes?: number };
			close: { day: number; time: string; hours?: number; minutes?: number };
		}>;
		weekdayDescriptions?: string[];
	};
}

interface TextSearchResponse {
	places?: PlaceSearchResult[];
}

export async function fetchOpeningHoursForStation(
	name: string,
	address: string,
	latitude: number,
	longitude: number
): Promise<OpeningHours | null> {
	const apiKey = getApiKey();

	const query = `${name} ${address}`;

	const body = {
		textQuery: query,
		locationBias: {
			circle: {
				center: { latitude, longitude },
				radius: 500
			}
		},
		pageSize: 1,
		languageCode: 'en-AU'
	};

	try {
		const response = await fetch(`${PLACES_API_BASE}/places:searchText?key=${apiKey}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			console.error(`[google-places] Text search failed: ${response.status} for "${query}"`);
			return null;
		}

		const data = await response.json() as TextSearchResponse;

		if (!data.places || data.places.length === 0) {
			return null;
		}

		const place = data.places[0];
		const hours = place.currentOpeningHours;

		if (!hours || !hours.periods || hours.periods.length === 0) {
			return null;
		}

		return {
			periods: hours.periods,
			weekdayText: hours.weekdayDescriptions || [],
			openNow: hours.openNow
		};
	} catch (err) {
		console.error(`[google-places] Error fetching hours for "${name}":`, err instanceof Error ? err.message : err);
		return null;
	}
}

export function isOpenNow(hours: OpeningHours): boolean {
	const now = new Date();
	const day = now.getDay();
	const currentMinutes = now.getHours() * 60 + now.getMinutes();

	for (const period of hours.periods) {
		const openDay = period.open.day;
		const closeDay = period.close.day;

		const openMinutes = (period.open.hours ?? 0) * 60 + (period.open.minutes ?? 0);
		const closeMinutes = (period.close.hours ?? 0) * 60 + (period.close.minutes ?? 0);

		if (openDay === closeDay) {
			if (day === openDay && currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
				return true;
			}
		} else if (openDay < closeDay) {
			if (day === openDay && currentMinutes >= openMinutes) return true;
			if (day === closeDay && currentMinutes < closeMinutes) return true;
			const daysBetween = closeDay - openDay;
			for (let d = 1; d < daysBetween; d++) {
				if (day === (openDay + d) % 7) return true;
			}
		} else {
			if (day === openDay && currentMinutes >= openMinutes) return true;
			if (day === closeDay && currentMinutes < closeMinutes) return true;
			if (day > openDay || day < closeDay) return true;
		}
	}

	return false;
}
