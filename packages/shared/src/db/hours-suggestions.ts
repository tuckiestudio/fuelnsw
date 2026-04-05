import { getDb } from './client.js';
import { updateStationOpeningHours } from './stations.js';

export interface HoursSuggestion {
	id: number;
	station_code: string;
	station_name?: string;
	station_brand?: string;
	opening_hours: string;
	submitted_at: string;
	status: 'pending' | 'approved' | 'rejected';
}

export function hasPendingSuggestion(stationCode: string): boolean {
	const db = getDb();
	const row = db.prepare(
		"SELECT 1 FROM hours_suggestions WHERE station_code = ? AND status = 'pending' LIMIT 1"
	).get(stationCode);
	return !!row;
}

export function createSuggestion(stationCode: string, openingHours: string): number {
	const db = getDb();
	const result = db.prepare(
		"INSERT INTO hours_suggestions (station_code, opening_hours) VALUES (?, ?)"
	).run(stationCode, openingHours);
	return Number(result.lastInsertRowid);
}

export function getPendingSuggestions(limit = 100, offset = 0): HoursSuggestion[] {
	const db = getDb();
	return db.prepare(`
		SELECT hs.*, s.name as station_name, s.brand as station_brand
		FROM hours_suggestions hs
		JOIN stations s ON s.code = hs.station_code
		WHERE hs.status = 'pending'
		ORDER BY hs.submitted_at ASC
		LIMIT ? OFFSET ?
	`).all(limit, offset) as HoursSuggestion[];
}

export function getPendingCount(): number {
	const db = getDb();
	const row = db.prepare("SELECT COUNT(*) as c FROM hours_suggestions WHERE status = 'pending'").get() as { c: number };
	return row.c;
}

export function approveSuggestion(id: number): { station_code: string } | null {
	const db = getDb();
	const suggestion = db.prepare(
		'SELECT * FROM hours_suggestions WHERE id = ? AND status = \'pending\''
	).get(id) as HoursSuggestion | undefined;
	if (!suggestion) return null;

	const update = db.transaction(() => {
		updateStationOpeningHours(suggestion.station_code, suggestion.opening_hours);
		db.prepare(
			"UPDATE hours_suggestions SET status = 'approved' WHERE id = ?"
		).run(id);
		db.prepare(
			"DELETE FROM hours_suggestions WHERE station_code = ? AND status = 'pending' AND id != ?"
		).run(suggestion.station_code, id);
	});
	update();

	return { station_code: suggestion.station_code };
}

export function rejectSuggestion(id: number): boolean {
	const db = getDb();
	const result = db.prepare(
		"UPDATE hours_suggestions SET status = 'rejected' WHERE id = ? AND status = 'pending'"
	).run(id);
	return result.changes > 0;
}
