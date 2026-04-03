import { getDb } from './client.js';

export function initializeSchema(): void {
	const db = getDb();

	db.exec(`
		CREATE INDEX IF NOT EXISTS idx_pending_drops_miss_count
			ON pending_drops(miss_count);
	`);

	const tableInfo = db.prepare("PRAGMA table_info(stations)").all() as { name: string }[];
	const columns = tableInfo.map(c => c.name);
	if (!columns.includes('opening_hours')) {
		db.exec("ALTER TABLE stations ADD COLUMN opening_hours TEXT");
	}
	if (!columns.includes('hours_last_fetched')) {
		db.exec("ALTER TABLE stations ADD COLUMN hours_last_fetched TEXT");
	}
}
