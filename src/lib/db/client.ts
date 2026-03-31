import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import 'dotenv/config';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'fuelnsw.sqlite');

let db: Database.Database;

export function getDb(): Database.Database {
	if (!db) {
		mkdirSync(DATA_DIR, { recursive: true });
		db = new Database(DB_PATH);
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
