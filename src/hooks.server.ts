import type { Handle } from '@sveltejs/kit';
import { initializeSchema } from '$lib/db/schema';
import { backfillFromStaleRecords } from '$lib/db/availability';

let started = false;

export const handle: Handle = async ({ event, resolve }) => {
	if (!started) {
		started = true;
		initializeSchema();
		backfillFromStaleRecords();
		import('$lib/scheduler').then(m => m.startScheduler());
	}

	return resolve(event);
};
