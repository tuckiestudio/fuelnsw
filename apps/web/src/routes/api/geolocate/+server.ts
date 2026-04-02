import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

function isValidIp(ip: string): boolean {
	if (!ip) return false;
	if (IPV4_RE.test(ip)) {
		return ip.split('.').every(octet => { const n = parseInt(octet, 10); return n >= 0 && n <= 255; });
	}
	return IPV6_RE.test(ip) && ip.length <= 45;
}

export const GET: RequestHandler = async ({ request }) => {
	try {
		const forwarded = request.headers.get('x-forwarded-for');
		const rawIp = forwarded?.split(',').pop()?.trim() || '';
		const ip = isValidIp(rawIp) ? rawIp : '';
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
