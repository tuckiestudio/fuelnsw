import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { timingSafeEqual } from 'node:crypto';
import { approveSuggestion } from '@fuelnsw/shared/db/hours-suggestions';
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

export const POST: RequestHandler = async ({ request, params }) => {
	if (!checkAuth(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		return json({ error: 'Invalid ID' }, { status: 400 });
	}

	const result = approveSuggestion(id);
	if (!result) {
		return json({ error: 'Suggestion not found or already processed' }, { status: 404 });
	}

	return json({ status: 'approved', station_code: result.station_code });
};
