import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '@fuelnsw/shared/db/client';

export const GET: RequestHandler = async () => {
	const db = getDb();
	let dbOk = false;
	let dataFresh = false;
	let lastRefresh: string | null = null;

	try {
		db.prepare('SELECT 1').get();
		dbOk = true;

		const row = db.prepare('SELECT fetched_at FROM refresh_log ORDER BY id DESC LIMIT 1').get() as { fetched_at: string } | undefined;
		if (row?.fetched_at) {
			lastRefresh = row.fetched_at;
			const elapsed = Date.now() - new Date(row.fetched_at).getTime();
			dataFresh = elapsed < 12 * 60 * 60 * 1000;
		}
	} catch {
		dbOk = false;
	}

	const status = !dbOk ? 'degraded' : !dataFresh ? 'stale' : 'ok';
	const statusCode = !dbOk ? 503 : 200;

	return json(
		{
			status,
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			database: dbOk ? 'connected' : 'error',
			dataFresh,
			lastRefresh
		},
		{ status: statusCode }
	);
};
