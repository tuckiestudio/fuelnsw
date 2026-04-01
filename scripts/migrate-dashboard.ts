#!/usr/bin/env tsx
/**
 * Dashboard Migration Script
 * 
 * Creates database schema and backfills data for the dashboard feature.
 * Auto-runs on first deploy.
 * 
 * Tables created:
 * - postcode_sa4_mapping: Maps postcodes to SA4 regions
 * - weekly_price_aggregates: Pre-aggregated weekly price statistics
 * 
 * Columns added:
 * - stations.brand_group: Grouped brand names (Ampol, Caltex, Independent)
 */

import { getDb } from '../packages/shared/src/db/client.js';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const SA4_MAPPING_PATH = join(process.cwd(), 'src/data/sa4-postcode-mapping.json');

interface MigrationStats {
  postcodesMapped: number;
  stationsUpdated: number;
  weeksBackfilled: number;
  aggregatesCreated: number;
}

function loadSA4Mapping(): Record<string, string> {
  try {
    const content = readFileSync(SA4_MAPPING_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load SA4 mapping from ${SA4_MAPPING_PATH}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function createPostcodeMappingTable(db: any): number {
  console.log('Creating postcode_sa4_mapping table...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS postcode_sa4_mapping (
      postcode TEXT PRIMARY KEY,
      sa4_region TEXT NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_postcode_region ON postcode_sa4_mapping(postcode);
  `);
  
  const mapping = loadSA4Mapping();
  const postcodes = Object.keys(mapping);
  
  console.log(`  Inserting ${postcodes.length} postcode mappings...`);
  
  const stmt = db.prepare('INSERT OR REPLACE INTO postcode_sa4_mapping (postcode, sa4_region) VALUES (?, ?)');
  const transaction = db.transaction((mappings: Array<[string, string]>) => {
    for (const [postcode, region] of mappings) {
      stmt.run(postcode, region);
    }
  });
  
  const entries = Object.entries(mapping);
  transaction(entries);
  
  console.log(`  ✓ Created ${postcodes.length} postcode mappings`);
  return postcodes.length;
}

function addBrandGroupColumn(db: any): number {
  console.log('Adding brand_group column to stations...');
  
  try {
    db.exec(`
      ALTER TABLE stations ADD COLUMN brand_group TEXT;
    `);
  } catch (error: any) {
    if (error.message.includes('duplicate column')) {
      console.log('  brand_group column already exists, skipping...');
    } else {
      throw error;
    }
  }
  
  console.log('  Updating brand_group values...');
  
  db.exec(`
    UPDATE stations SET brand_group = 
      CASE 
        WHEN brand IN ('EG Ampol', 'Ampol Foodary', 'Ampol Breeze', 'EBM Ampol') THEN 'Ampol'
        WHEN brand IN ('Caltex Woolworths') THEN 'Caltex'
        WHEN brand IN ('Independent EV') THEN 'Independent'
        ELSE brand
      END
    WHERE brand IS NOT NULL AND brand != '';
  `);
  
  const result = db.prepare('SELECT COUNT(*) as c FROM stations WHERE brand_group IS NOT NULL').get() as { c: number };
  console.log(`  ✓ Updated ${result.c} stations with brand_group`);
  return result.c;
}

function createWeeklyAggregatesTable(db: any): void {
  console.log('Creating weekly_price_aggregates table...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_price_aggregates (
      week_start DATE NOT NULL,
      sa4_region TEXT NOT NULL,
      brand_group TEXT NOT NULL,
      fuel_type TEXT NOT NULL,
      avg_price REAL NOT NULL,
      min_price REAL NOT NULL,
      max_price REAL NOT NULL,
      station_count INTEGER NOT NULL,
      PRIMARY KEY (week_start, sa4_region, brand_group, fuel_type)
    );
    
    CREATE INDEX IF NOT EXISTS idx_weekly_region_date ON weekly_price_aggregates(sa4_region, week_start DESC);
    CREATE INDEX IF NOT EXISTS idx_weekly_brand_date ON weekly_price_aggregates(brand_group, week_start DESC);
    CREATE INDEX IF NOT EXISTS idx_weekly_fuel_date ON weekly_price_aggregates(fuel_type, week_start DESC);
    CREATE INDEX IF NOT EXISTS idx_weekly_date ON weekly_price_aggregates(week_start DESC);
  `);
  
  console.log('  ✓ Created weekly_price_aggregates table with indexes');
}

function backfillWeeklyAggregates(db: any): { weeks: number; rows: number } {
  console.log('Backfilling weekly aggregates from historical data...');
  
  const startDate = db.prepare(`
    SELECT MIN(price_updated) as min_date FROM historical_prices
  `).get() as { min_date: string };
  
  const endDate = db.prepare(`
    SELECT MAX(price_updated) as max_date FROM historical_prices
  `).get() as { max_date: string };
  
  console.log(`  Historical data range: ${startDate.min_date} to ${endDate.max_date}`);
  
  const beforeCount = db.prepare('SELECT COUNT(*) as c FROM weekly_price_aggregates').get() as { c: number };
  
  db.exec(`
    INSERT OR REPLACE INTO weekly_price_aggregates (week_start, sa4_region, brand_group, fuel_type, avg_price, min_price, max_price, station_count)
    SELECT 
      DATE(hp.price_updated, 'weekday 0', '-6 days') as week_start,
      pcm.sa4_region,
      s.brand_group,
      CASE
        WHEN hp.fuel_type IN ('DL', 'Diesel') THEN 'Diesel'
        WHEN hp.fuel_type IN ('U91', 'Unleaded') THEN 'Unleaded'
        ELSE hp.fuel_type
      END as fuel_type,
      AVG(hp.price) as avg_price,
      MIN(hp.price) as min_price,
      MAX(hp.price) as max_price,
      COUNT(DISTINCT hp.station_code) as station_count
    FROM historical_prices hp
    JOIN stations s ON hp.station_code = s.code
    JOIN postcode_sa4_mapping pcm ON s.postcode = pcm.postcode
    WHERE hp.fuel_type IN ('DL', 'Diesel', 'U91', 'Unleaded', 'E10', 'P95', 'P98', 'LPG')
    GROUP BY week_start, sa4_region, brand_group, fuel_type;
  `);
  
  const afterCount = db.prepare('SELECT COUNT(*) as c FROM weekly_price_aggregates').get() as { c: number };
  const newRows = afterCount.c - beforeCount.c;
  
  const weekCount = db.prepare(`
    SELECT COUNT(DISTINCT week_start) as weeks FROM weekly_price_aggregates
  `).get() as { weeks: number };
  
  console.log(`  ✓ Created ${newRows.toLocaleString()} aggregate rows across ${weekCount.weeks} weeks`);
  return { weeks: weekCount.weeks, rows: newRows };
}

function createAdditionalIndexes(db: any): void {
  console.log('Creating additional performance indexes...');
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_historical_date ON historical_prices(price_updated DESC);
    CREATE INDEX IF NOT EXISTS idx_historical_station_date ON historical_prices(station_code, price_updated DESC);
    CREATE INDEX IF NOT EXISTS idx_stations_brand_group ON stations(brand_group);
    CREATE INDEX IF NOT EXISTS idx_stations_postcode ON stations(postcode);
  `);
  
  console.log('  ✓ Created performance indexes');
}

function verifyMigration(db: any): void {
  console.log('Verifying migration...');
  
  const postcodeCount = db.prepare('SELECT COUNT(*) as c FROM postcode_sa4_mapping').get() as { c: number };
  const stationCount = db.prepare('SELECT COUNT(*) as c FROM stations WHERE brand_group IS NOT NULL').get() as { c: number };
  const aggregateCount = db.prepare('SELECT COUNT(*) as c FROM weekly_price_aggregates').get() as { c: number };
  const weekCount = db.prepare('SELECT COUNT(DISTINCT week_start) as c FROM weekly_price_aggregates').get() as { c: number };
  
  console.log('');
  console.log('Migration Summary:');
  console.log(`  ✓ Postcode mappings: ${postcodeCount.c}`);
  console.log(`  ✓ Stations with brand_group: ${stationCount.c}`);
  console.log(`  ✓ Weekly aggregates: ${aggregateCount.c.toLocaleString()}`);
  console.log(`  ✓ Weeks covered: ${weekCount.c}`);
  console.log('');
  
  if (postcodeCount.c === 0) {
    throw new Error('Migration failed: No postcode mappings created');
  }
  if (aggregateCount.c === 0) {
    throw new Error('Migration failed: No weekly aggregates created');
  }
}

export async function runMigration(): Promise<MigrationStats> {
  console.log('='.repeat(60));
  console.log('Dashboard Migration Script');
  console.log('='.repeat(60));
  console.log('');
  
  const db = getDb();
  
  try {
    const postcodesMapped = createPostcodeMappingTable(db);
    const stationsUpdated = addBrandGroupColumn(db);
    createWeeklyAggregatesTable(db);
    const { weeks, rows } = backfillWeeklyAggregates(db);
    createAdditionalIndexes(db);
    verifyMigration(db);
    
    console.log('='.repeat(60));
    console.log('✓ Migration completed successfully!');
    console.log('='.repeat(60));
    
    return {
      postcodesMapped,
      stationsUpdated,
      weeksBackfilled: weeks,
      aggregatesCreated: rows
    };
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('✗ Migration failed!');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('');
    console.error('Please fix the error and re-run the migration.');
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
