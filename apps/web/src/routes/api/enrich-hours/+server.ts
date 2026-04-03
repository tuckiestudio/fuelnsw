import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { timingSafeEqual } from 'node:crypto';
import { refreshAllOpeningHours } from '@fuelnsw/shared/scheduler';
import 'dotenv/config';

function checkAuth(request: Request): boolean {
	const adminToken = process.env.ADMIN_TOKEN;
	if (!adminToken) return false;
	const auth = request.headers.get('authorization');
	if (!auth) return false;
	const parts = auth.split(' ');
	if (parts.length !== 2 || parts[0] !== 'Bearer') return false;
	const a = Buffer.from(parts[1]);
	const b = Buffer.from(adminToken);
	return a.length === b.length && timingSafeEqual(a, b);
}

export const POST: RequestHandler = async ({ request }) => {
	if (!checkAuth(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!process.env.GOOGLE_PLACES_API_KEY) {
		return json({ error: 'GOOGLE_PLACES_API_KEY not configured' }, { status: 400 });
	}

	try {
		const result = await refreshAllOpeningHours();
		return json({ status: 'success', ...result });
	} catch (err) {
		return json({
			status: 'error',
			message: err instanceof Error ? err.message : 'Unknown error'
		}, { status: 500 });
	}
};
