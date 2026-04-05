import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { timingSafeEqual } from 'node:crypto';
import { getPendingSuggestions, getPendingCount } from '@fuelnsw/shared/db/hours-suggestions';
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

export const GET: RequestHandler = async ({ request, url }) => {
	if (!checkAuth(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
	const offset = parseInt(url.searchParams.get('offset') || '0');

	const suggestions = getPendingSuggestions(limit, offset);
	const total = getPendingCount();

	return json({ suggestions, total });
};
