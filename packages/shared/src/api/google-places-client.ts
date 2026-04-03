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
			open: { day: number; hour?: number; minute?: number };
			close: { day: number; hour?: number; minute?: number };
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
			headers: {
				'Content-Type': 'application/json',
				'X-Goog-FieldMask': 'places.id,places.currentOpeningHours'
			},
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
	const sydney = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
	const day = sydney.getDay();
	const currentMinutes = sydney.getHours() * 60 + sydney.getMinutes();

	for (const period of hours.periods) {
		const openDay = period.open.day;
		const closeDay = period.close.day;

		const openMinutes = (period.open.hour ?? period.open.hours ?? 0) * 60 + (period.open.minute ?? period.open.minutes ?? 0);
		const closeMinutes = (period.close.hour ?? period.close.hours ?? 0) * 60 + (period.close.minute ?? period.close.minutes ?? 0);

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
