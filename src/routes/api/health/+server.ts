import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db/client';

export const GET: RequestHandler = async () => {
	const db = getDb();
	let dbOk = false;
	try {
		db.prepare('SELECT 1').get();
		dbOk = true;
	} catch {
		dbOk = false;
	}

	const status = dbOk ? 'ok' : 'degraded';
	const statusCode = dbOk ? 200 : 503;

	return json(
		{
			status,
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			database: dbOk ? 'connected' : 'error'
		},
		{ status: statusCode }
	);
};
