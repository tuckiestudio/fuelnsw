/**
 * Historical Fuel Price Importer for Data.NSW FuelCheck dataset
 *
 * Downloads and imports ~10 years of historical fuel price data from
 * https://data.nsw.gov.au/data/dataset/fuel-check into the local SQLite database.
 *
 * Data sources:
 *   - CKAN DataStore API for resources with API access (mostly recent CSVs)
 *   - Direct XLSX download + parse for older Excel files
 *
 * Usage:
 *   npx tsx scripts/import-history.ts              # Import all resources
 *   npx tsx scripts/import-history.ts --dry-run     # Show what would be imported
 *   npx tsx scripts/import-history.ts --resource ID # Import specific resource only
 *   npx tsx scripts/import-history.ts --api-only    # Only fetch API-accessible resources
 *   npx tsx scripts/import-history.ts --xlsx-only   # Only download/parse XLSX files
 */

import { getDb } from '../src/lib/db/client.js';
import { initializeSchema } from '../src/lib/db/schema.js';
import Database from 'better-sqlite3';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CkanResource {
	id: string;
	name: string;
	format: string;
	datastore_active: boolean;
	url: string;
	size?: number;
}

interface CkanPackageResponse {
	success: boolean;
	result: {
		resources: CkanResource[];
	};
}

interface DataStoreRecord {
	[key: string]: string | number | null;
}

interface ParsedPriceRow {
	stationCode: string;
	stationName: string;
	brand: string;
	address: string;
	suburb: string;
	postcode: string;
	fuelType: string;
	price: number;
	priceDate: string; // YYYY-MM-DD
}

interface ImportProgress {
	completedResources: string[]; // resource IDs that have been fully imported
	lastRun: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CKAN_API_BASE = 'https://data.nsw.gov.au/data/api/3/action';
const DATASTORE_SEARCH = `${CKAN_API_BASE}/datastore_search`;
const PACKAGE_SHOW = `${CKAN_API_BASE}/package_show?id=fuel-check`;
const DATA_DIR = join(process.cwd(), 'data');
const CACHE_DIR = join(DATA_DIR, 'xlsx-cache');
const PROGRESS_FILE = join(DATA_DIR, 'import-progress.json');
const BATCH_SIZE = 500; // records per DB transaction
const API_PAGE_SIZE = 5000; // records per API request
const FETCH_DELAY_MS = 300; // delay between API requests to be polite

// Column name variations found across different Data.NSW resources
const STATION_NAME_COLS = ['ServiceStationName', 'servicestationname', 'Service Station Name'];
const ADDRESS_COLS = ['Address', 'address'];
const SUBURB_COLS = ['Suburb', 'suburb'];
const POSTCODE_COLS = ['Postcode', 'postcode'];
const BRAND_COLS = ['Brand', 'brand'];
const FUEL_CODE_COLS = ['FuelCode', 'fuelcode', 'Fuel Code'];
const PRICE_COLS = ['Price', 'price'];
const PRICE_DATE_COLS = ['PriceUpdatedDate', 'priceupdateddate', 'PriceUpdated', 'Price Updated Date'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

/** Find the first matching column from a list of candidates */
function findColumn(headers: string[], candidates: string[]): string | null {
	const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
	for (const candidate of candidates) {
		const idx = lowerHeaders.indexOf(candidate.toLowerCase());
		if (idx !== -1) return headers[idx];
	}
	return null;
}

/** Generate a deterministic station code from name + address */
function generateStationCode(name: string, address: string): string {
	const raw = `${name}|${address}`.toLowerCase().trim();
	// Simple hash to create a short code
	let hash = 0;
	for (let i = 0; i < raw.length; i++) {
		const chr = raw.charCodeAt(i);
		hash = (hash << 5) - hash + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return `hist_${Math.abs(hash).toString(36)}`;
}

/**
 * Parse date strings from Data.NSW into YYYY-MM-DD format.
 * Handles formats:
 *   - "2025-01-01 02:17:21" (ISO-like)
 *   - "1/10/2025 0:00"      (d/M/yyyy H:mm)
 *   - "01/10/2025 00:00"    (dd/MM/yyyy HH:mm)
 *   - "2025-01-01T00:00:00" (ISO 8601)
 *   - 43344.003             (Excel serial date number)
 *   - "1/08/2022 12:06:37 AM" (d/M/yyyy h:mm:ss AM/PM)
 */
function parseDate(raw: string | number | null): string | null {
	if (raw === null || raw === undefined) return null;

	// Excel serial date number
	if (typeof raw === 'number') {
		// Excel serial date: days since 1899-12-30 (with the Lotus 123 bug)
		const epoch = new Date(1899, 11, 30);
		const date = new Date(epoch.getTime() + raw * 86400000);
		if (isNaN(date.getTime())) return null;
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	const str = String(raw).trim();
	if (!str) return null;

	// Try ISO format first: 2025-01-01 02:17:21 or 2025-01-01T00:00:00
	const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (isoMatch) {
		return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
	}

	// Try d/M/yyyy format: 1/10/2025 0:00 or 1/08/2022 12:06:37 AM
	const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
	if (dmyMatch) {
		const day = dmyMatch[1].padStart(2, '0');
		const month = dmyMatch[2].padStart(2, '0');
		const year = dmyMatch[3];
		return `${year}-${month}-${day}`;
	}

	return null;
}

/** Clean and normalize a price value */
function parsePrice(raw: string | number | null): number | null {
	if (raw === null || raw === undefined) return null;
	const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
	return isNaN(num) ? null : Math.round(num * 10) / 10;
}

/** Load import progress from disk */
function loadProgress(): ImportProgress {
	if (existsSync(PROGRESS_FILE)) {
		return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
	}
	return { completedResources: [], lastRun: '' };
}

/** Save import progress to disk */
function saveProgress(progress: ImportProgress): void {
	progress.lastRun = new Date().toISOString();
	writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ─── CKAN API ────────────────────────────────────────────────────────────────

/** Fetch the list of all resources in the FuelCheck dataset */
async function fetchResources(): Promise<CkanResource[]> {
	console.log('Fetching resource list from Data.NSW...');
	const res = await fetch(PACKAGE_SHOW);
	if (!res.ok) throw new Error(`Failed to fetch package: ${res.status} ${res.statusText}`);
	const data = (await res.json()) as CkanPackageResponse;
	if (!data.success) throw new Error('CKAN API returned success=false');

	// Filter to only data resources (exclude website links, DQS docs)
	const dataResources = data.result.resources.filter(
		(r) =>
			r.format &&
			!['website link', 'dqs - pdf', 'dqs - xml', ''].includes(r.format.toLowerCase().trim())
	);

	console.log(`Found ${dataResources.length} data resources (${dataResources.filter((r) => r.datastore_active).length} with API access)`);
	return dataResources;
}

/** Fetch all records from a DataStore-enabled resource via paginated API */
async function fetchFromDataStore(resourceId: string, resourceName: string): Promise<DataStoreRecord[]> {
	const allRecords: DataStoreRecord[] = [];
	let offset = 0;
	let total: number | null = null;

	console.log(`  Fetching from DataStore API: ${resourceName}`);

	while (true) {
		const url = `${DATASTORE_SEARCH}?resource_id=${resourceId}&limit=${API_PAGE_SIZE}&offset=${offset}`;
		const res = await fetch(url);
		if (!res.ok) {
			console.warn(`  Warning: API request failed at offset ${offset}: ${res.status}`);
			break;
		}

		const data = await res.json();
		if (!data.success) {
			console.warn(`  Warning: API returned success=false at offset ${offset}`);
			break;
		}

		const records = data.result.records as DataStoreRecord[];
		if (!total) {
			total = data.result.total as number;
			console.log(`  Total records: ${total}`);
		}

		allRecords.push(...records);
		offset += records.length;

		process.stdout.write(`  Fetched ${allRecords.length}/${total} records\r`);

		if (records.length < API_PAGE_SIZE) break; // last page
		await delay(FETCH_DELAY_MS);
	}

	console.log(`  Fetched ${allRecords.length} records total                    `);
	return allRecords;
}

/** Download an XLSX file and return the path to the cached file */
async function downloadXlsx(resource: CkanResource): Promise<string> {
	mkdirSync(CACHE_DIR, { recursive: true });
	const cachePath = join(CACHE_DIR, `${resource.id}.xlsx`);

	if (existsSync(cachePath)) {
		console.log(`  Using cached file: ${cachePath}`);
		return cachePath;
	}

	console.log(`  Downloading: ${resource.name} (${(resource.size ? (resource.size / 1024 / 1024).toFixed(1) + 'MB' : 'unknown size')})`);
	const res = await fetch(resource.url);
	if (!res.ok) throw new Error(`Download failed: ${res.status}`);

	const buffer = Buffer.from(await res.arrayBuffer());
	writeFileSync(cachePath, buffer);
	console.log(`  Saved to: ${cachePath}`);
	return cachePath;
}

/** Parse an XLSX file and return records as DataStoreRecord-like objects */
async function parseXlsx(filePath: string): Promise<DataStoreRecord[]> {
	const XLSX = await import('xlsx');
	const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' });

	// Use the first sheet
	const sheetName = workbook.SheetNames[0];
	const sheet = workbook.Sheets[sheetName];

	// Try with header at row 0 first
	let rows = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(sheet, {
		defval: null
	});

	// If columns look like __EMPTY or the first key isn't a known column, the real headers are further down
	if (
		rows.length > 0 &&
		!Object.keys(rows[0]).includes('ServiceStationName') &&
		(Object.keys(rows[0]).some((k) => k.startsWith('__')) || Object.keys(rows[0]).some((k) => k.includes('Price History')))
	) {
		// Find the row with actual column headers by scanning raw cells
		const range = XLSX.utils.decode_range(sheet['!ref']!);
		let headerRow = 0;
		for (let r = 0; r <= Math.min(10, range.e.r); r++) {
			const cell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
			if (cell && String(cell.v).trim() === 'ServiceStationName') {
				headerRow = r;
				break;
			}
		}
		if (headerRow > 0) {
			// Re-parse starting from the header row
			const newRef = XLSX.utils.encode_range({
				s: { r: headerRow, c: 0 },
				e: range.e
			});
			sheet['!ref'] = newRef;
			rows = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(sheet, {
				defval: null
			});
		}
	}

	console.log(`  Parsed ${rows.length} rows from sheet "${sheetName}"`);
	return rows as DataStoreRecord[];
}

// ─── Record Parsing ──────────────────────────────────────────────────────────

/** Parse raw records into structured price rows */
function parseRecords(records: DataStoreRecord[], resourceName: string): ParsedPriceRow[] {
	if (records.length === 0) return [];

	const headers = Object.keys(records[0]);
	const stationNameCol = findColumn(headers, STATION_NAME_COLS);
	const addressCol = findColumn(headers, ADDRESS_COLS);
	const suburbCol = findColumn(headers, SUBURB_COLS);
	const postcodeCol = findColumn(headers, POSTCODE_COLS);
	const brandCol = findColumn(headers, BRAND_COLS);
	const fuelCodeCol = findColumn(headers, FUEL_CODE_COLS);
	const priceCol = findColumn(headers, PRICE_COLS);
	const priceDateCol = findColumn(headers, PRICE_DATE_COLS);

	if (!stationNameCol || !fuelCodeCol || !priceCol || !priceDateCol) {
		console.warn(`  Skipping ${resourceName}: missing required columns.`);
		console.warn(`  Found columns: ${headers.join(', ')}`);
		console.warn(`  Detected: station=${stationNameCol}, fuel=${fuelCodeCol}, price=${priceCol}, date=${priceDateCol}`);
		return [];
	}

	const parsed: ParsedPriceRow[] = [];
	let skipped = 0;

	for (const rec of records) {
		const stationName = String(rec[stationNameCol] ?? '').trim();
		const fuelType = String(rec[fuelCodeCol] ?? '').trim();
		const price = parsePrice(rec[priceCol]);
		const priceDate = parseDate(rec[priceDateCol]);
		const address = addressCol ? String(rec[addressCol] ?? '').trim() : stationName;
		const suburb = suburbCol ? String(rec[suburbCol] ?? '').trim().toUpperCase() : '';
		const postcode = postcodeCol ? String(rec[postcodeCol] ?? '').trim() : '';
		const brand = brandCol ? String(rec[brandCol] ?? '').trim() : '';

		if (!stationName || !fuelType || price === null || !priceDate) {
			skipped++;
			continue;
		}

		parsed.push({
			stationCode: generateStationCode(stationName, address),
			stationName,
			brand,
			address,
			suburb,
			postcode,
			fuelType,
			price,
			priceDate
		});
	}

	if (skipped > 0) {
		console.log(`  Skipped ${skipped} records with missing data`);
	}

	return parsed;
}

// ─── Database Import ─────────────────────────────────────────────────────────

const UPSERT_STATION = `
	INSERT INTO stations (code, name, brand, address, suburb, state, postcode, latitude, longitude, last_seen)
	VALUES (?, ?, ?, ?, ?, 'NSW', ?, 0, 0, ?)
	ON CONFLICT(code) DO UPDATE SET
		name = CASE WHEN length(excluded.name) > length(stations.name) THEN excluded.name ELSE stations.name END,
		brand = CASE WHEN excluded.brand != '' THEN excluded.brand ELSE stations.brand END,
		address = CASE WHEN length(excluded.address) > length(stations.address) THEN excluded.address ELSE stations.address END,
		suburb = CASE WHEN excluded.suburb != '' THEN excluded.suburb ELSE stations.suburb END,
		postcode = CASE WHEN excluded.postcode != '' THEN excluded.postcode ELSE stations.postcode END,
		last_seen = excluded.last_seen
`;

const UPSERT_HISTORICAL = `
	INSERT INTO historical_prices (station_code, fuel_type, price, price_updated)
	VALUES (?, ?, ?, ?)
	ON CONFLICT(station_code, fuel_type, price_updated) DO UPDATE SET
		price = excluded.price
`;

const UPSERT_DAILY_SNAPSHOT = `
	INSERT INTO daily_snapshots (snapshot_date, station_code, fuel_type, price)
	VALUES (?, ?, ?, ?)
	ON CONFLICT(snapshot_date, station_code, fuel_type) DO UPDATE SET
		price = excluded.price
`;

function importBatch(db: Database.Database, rows: ParsedPriceRow[]): void {
	const stationStmt = db.prepare(UPSERT_STATION);
	const histStmt = db.prepare(UPSERT_HISTORICAL);
	const snapStmt = db.prepare(UPSERT_DAILY_SNAPSHOT);

	const transaction = db.transaction((items: ParsedPriceRow[]) => {
		for (const row of items) {
			stationStmt.run(
				row.stationCode,
				row.stationName,
				row.brand,
				row.address,
				row.suburb,
				row.postcode,
				row.priceDate
			);
			histStmt.run(row.stationCode, row.fuelType, row.price, row.priceDate);
			snapStmt.run(row.priceDate, row.stationCode, row.fuelType, row.price);
		}
	});

	transaction(rows);
}

// ─── Main Import Logic ───────────────────────────────────────────────────────

async function importResource(
	db: Database.Database,
	resource: CkanResource,
	dryRun: boolean
): Promise<{ recordsProcessed: number; skipped: boolean }> {
	// Check if already imported
	const progress = loadProgress();
	if (progress.completedResources.includes(resource.id)) {
		console.log(`  Already imported: ${resource.name} — skipping`);
		return { recordsProcessed: 0, skipped: true };
	}

	console.log(`\n${'─'.repeat(60)}`);
	console.log(`Processing: ${resource.name} (${resource.id})`);
	console.log(`Format: ${resource.format}, API: ${resource.datastore_active}`);

	let records: DataStoreRecord[];

	if (resource.datastore_active) {
		records = await fetchFromDataStore(resource.id, resource.name);
	} else {
		// Download XLSX and parse
		const xlsxPath = await downloadXlsx(resource);
		records = await parseXlsx(xlsxPath);
	}

	if (records.length === 0) {
		console.log(`  No records found — skipping`);
		return { recordsProcessed: 0, skipped: true };
	}

	// Parse records
	const parsed = parseRecords(records, resource.name);
	if (parsed.length === 0) {
		console.log(`  No valid price records — skipping`);
		return { recordsProcessed: 0, skipped: true };
	}

	console.log(`  Parsed ${parsed.length} valid price records`);
	console.log(`  Date range: ${parsed[0].priceDate} to ${parsed[parsed.length - 1].priceDate}`);

	// Unique stations in this batch
	const uniqueStations = new Set(parsed.map((p) => p.stationCode));
	console.log(`  Unique stations: ${uniqueStations.size}`);

	if (dryRun) {
		console.log(`  [DRY RUN] Would import ${parsed.length} records`);
		return { recordsProcessed: parsed.length, skipped: false };
	}

	// Import in batches
	let imported = 0;
	for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
		const batch = parsed.slice(i, i + BATCH_SIZE);
		importBatch(db, batch);
		imported += batch.length;
		process.stdout.write(`  Imported ${imported}/${parsed.length} records\r`);
	}
	console.log(`  Imported ${imported}/${parsed.length} records                  `);

	// Mark as completed
	if (!dryRun) {
		const currentProgress = loadProgress();
		currentProgress.completedResources.push(resource.id);
		saveProgress(currentProgress);
	}

	return { recordsProcessed: imported, skipped: false };
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const apiOnly = args.includes('--api-only');
	const xlsxOnly = args.includes('--xlsx-only');
	const resourceIdx = args.indexOf('--resource');
	const resourceArg = args.find((a) => a.startsWith('--resource='));
	const specificResource = resourceArg
		? resourceArg.split('=')[1]
		: resourceIdx !== -1 && args[resourceIdx + 1] && !args[resourceIdx + 1].startsWith('--')
			? args[resourceIdx + 1]
			: null;

	if (dryRun) console.log('DRY RUN MODE — no data will be written\n');

	// Initialize database
	initializeSchema();
	const db = getDb();

	// Fetch resource list
	let resources = await fetchResources();

	// Sort by name for consistent ordering (earliest first)
	resources.sort((a, b) => a.name.localeCompare(b.name));

	// Apply filters
	if (specificResource) {
		resources = resources.filter((r) => r.id === specificResource);
		if (resources.length === 0) {
			console.error(`Resource not found: ${specificResource}`);
			process.exit(1);
		}
	} else if (apiOnly) {
		resources = resources.filter((r) => r.datastore_active);
		console.log(`Filtered to ${resources.length} API-accessible resources`);
	} else if (xlsxOnly) {
		resources = resources.filter((r) => !r.datastore_active);
		console.log(`Filtered to ${resources.length} XLSX-download resources`);
	}

	// Show progress summary
	const progress = loadProgress();
	const alreadyDone = resources.filter((r) => progress.completedResources.includes(r.id)).length;
	const remaining = resources.length - alreadyDone;
	console.log(`\nResources to process: ${resources.length} (${alreadyDone} already done, ${remaining} remaining)`);

	if (remaining === 0 && !dryRun) {
		console.log('\nAll resources already imported! Delete data/import-progress.json to re-import.');
		return;
	}

	// Process each resource
	let totalRecords = 0;
	let totalStations = 0;
	const startTime = Date.now();

	for (const resource of resources) {
		try {
			const result = await importResource(db, resource, dryRun);
			totalRecords += result.recordsProcessed;
			if (result.recordsProcessed > 0 && !result.skipped) {
				// Count unique stations in this batch (approximate)
				totalStations += result.recordsProcessed > 0 ? 1 : 0; // Will count properly below
			}
		} catch (err) {
			console.error(`\n  ERROR processing ${resource.name}: ${err}`);
			console.error('  Continuing with next resource...\n');
		}
	}

	// Summary
	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	console.log(`\n${'═'.repeat(60)}`);
	console.log(`Import complete!`);
	console.log(`  Time: ${elapsed}s`);
	console.log(`  Records processed: ${totalRecords}`);

	if (!dryRun) {
		const stationCount = (
			db.prepare('SELECT COUNT(*) as count FROM stations').get() as { count: number }
		).count;
		const histCount = (
			db.prepare('SELECT COUNT(*) as count FROM historical_prices').get() as { count: number }
		).count;
		const snapCount = (
			db.prepare('SELECT COUNT(*) as count FROM daily_snapshots').get() as { count: number }
		).count;
		const dateRange = db
			.prepare('SELECT MIN(price_updated) as min_date, MAX(price_updated) as max_date FROM historical_prices')
			.get() as { min_date: string; max_date: string };

		console.log(`  Stations in DB: ${stationCount}`);
		console.log(`  Historical prices: ${histCount}`);
		console.log(`  Daily snapshots: ${snapCount}`);
		console.log(`  Date range: ${dateRange.min_date} to ${dateRange.max_date}`);
	}

	db.close();
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
