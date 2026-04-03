#!/usr/bin/env tsx
import { getDb } from '../packages/shared/src/db/client.js';

function migrate() {
	const db = getDb();

	const tableInfo = db.prepare("PRAGMA table_info(stations)").all() as { name: string }[];
	const columns = tableInfo.map(c => c.name);

	if (!columns.includes('opening_hours')) {
		console.log('[migration] Adding opening_hours column to stations...');
		db.exec("ALTER TABLE stations ADD COLUMN opening_hours TEXT");
		console.log('[migration] opening_hours column added');
	} else {
		console.log('[migration] opening_hours column already exists');
	}

	if (!columns.includes('hours_last_fetched')) {
		console.log('[migration] Adding hours_last_fetched column to stations...');
		db.exec("ALTER TABLE stations ADD COLUMN hours_last_fetched TEXT");
		console.log('[migration] hours_last_fetched column added');
	} else {
		console.log('[migration] hours_last_fetched column already exists');
	}

	console.log('[migration] Opening hours migration complete');
}

migrate();
