import Database from 'better-sqlite3';
import { resolve, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import 'dotenv/config';

let db: Database.Database;

function getDbPath(): string {
	const rawDir = process.env.DATA_DIR || join(process.cwd(), 'data');
	const dataDir = resolve(rawDir);
	return join(dataDir, 'fuelnsw.sqlite');
}

export function getDb(): Database.Database {
	if (!db) {
		const dbPath = getDbPath();
		const dataDir = resolve(join(dbPath, '..'));
		mkdirSync(dataDir, { recursive: true });
		db = new Database(dbPath);
		db.pragma('journal_mode = WAL');
		db.pragma('foreign_keys = ON');
		db.pragma('synchronous = NORMAL');
		db.pragma('cache_size = -64000');
		db.pragma('busy_timeout = 5000');
		db.pragma('temp_store = MEMORY');
	}
	return db;
}

export function closeDb(): void {
	if (db) {
		db.close();
		db = undefined as unknown as Database.Database;
	}
}
