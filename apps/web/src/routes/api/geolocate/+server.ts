import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
	try {
		const forwarded = request.headers.get('x-forwarded-for');
		const ip = forwarded?.split(',')[0]?.trim() || '';
		const url = ip
			? `http://ip-api.com/json/${ip}?fields=status,lat,lon`
			: `http://ip-api.com/json/?fields=status,lat,lon`;
		const res = await fetch(url);
		if (!res.ok) {
			return json({ error: 'Geolocation service unavailable' }, { status: 502 });
		}
		const data = await res.json();
		if (data.status === 'success' && data.lat != null && data.lon != null) {
			return json({ lat: data.lat, lng: data.lon });
		}
		return json({ error: 'Could not determine location' }, { status: 404 });
	} catch {
		return json({ error: 'Geolocation service unavailable' }, { status: 502 });
	}
};
