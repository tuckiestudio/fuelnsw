import { getDb } from './client.js';

export interface AggregationResult {
  weeksUpdated: number;
  rowsUpdated: number;
  duration: number;
}

export async function rebuildWeeklyAggregates(): Promise<AggregationResult> {
  const startTime = Date.now();
  const db = getDb();
  
  console.log('[weekly-aggregation] Starting weekly aggregation update...');
  
  try {
    const transaction = db.transaction(() => {
      console.log('[weekly-aggregation] Deleting old aggregates for affected weeks...');
      db.prepare(`
        DELETE FROM weekly_price_aggregates
        WHERE week_start >= DATE('now', '-7 days', 'weekday 0', '-6 days')
      `).run();
      
      console.log('[weekly-aggregation] Recalculating aggregates from historical data...');
      const result = db.prepare(`
        INSERT INTO weekly_price_aggregates (week_start, sa4_region, brand_group, fuel_type, avg_price, min_price, max_price, station_count)
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
        WHERE hp.price_updated >= DATE('now', '-7 days')
          AND hp.fuel_type IN ('DL', 'Diesel', 'U91', 'Unleaded', 'E10', 'P95', 'P98', 'LPG')
        GROUP BY week_start, sa4_region, brand_group, fuel_type
      `).run();
      
      return result;
    });
    
    const result = transaction();
    const duration = Date.now() - startTime;
    
    const weekCount = db.prepare(`
      SELECT COUNT(DISTINCT week_start) as weeks 
      FROM weekly_price_aggregates 
      WHERE week_start >= DATE('now', '-7 days', 'weekday 0', '-6 days')
    `).get() as { weeks: number };
    
    console.log(`[weekly-aggregation] ✓ Complete: ${result.changes.toLocaleString()} rows updated across ${weekCount.weeks} weeks in ${duration}ms`);
    
    return {
      weeksUpdated: weekCount.weeks,
      rowsUpdated: result.changes,
      duration
    };
  } catch (error) {
    console.error('[weekly-aggregation] ✗ Failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

export function scheduleNightlyAggregation(): void {
  const SYDNEY_OFFSET = 11 * 60 * 60 * 1000;
  const targetHour = 2;
  
  const now = new Date();
  const next2AM = new Date(now);
  next2AM.setHours(targetHour, 0, 0, 0);
  
  if (now > next2AM) {
    next2AM.setDate(next2AM.getDate() + 1);
  }
  
  const delay = next2AM.getTime() - now.getTime();
  const delayMinutes = Math.floor(delay / (1000 * 60));
  
  console.log(`[weekly-aggregation] Scheduled for ${next2AM.toISOString()} (in ${delayMinutes} minutes)`);
  
  setTimeout(() => {
    console.log('[weekly-aggregation] Running scheduled aggregation...');
    rebuildWeeklyAggregates()
      .then(() => {
        console.log('[weekly-aggregation] Scheduled run complete');
      })
      .catch((error) => {
        console.error('[weekly-aggregation] Scheduled run failed:', error);
      })
      .finally(() => {
        scheduleNightlyAggregation();
      });
  }, delay);
}

export async function backfillAllWeeklyAggregates(): Promise<AggregationResult> {
  const startTime = Date.now();
  const db = getDb();
  
  console.log('[weekly-aggregation] Starting full backfill...');
  
  try {
    const transaction = db.transaction(() => {
      console.log('[weekly-aggregation] Clearing existing aggregates...');
      db.prepare('DELETE FROM weekly_price_aggregates').run();
      
      console.log('[weekly-aggregation] Recalculating all historical aggregates...');
      const result = db.prepare(`
        INSERT INTO weekly_price_aggregates (week_start, sa4_region, brand_group, fuel_type, avg_price, min_price, max_price, station_count)
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
        GROUP BY week_start, sa4_region, brand_group, fuel_type
      `).run();
      
      return result;
    });
    
    const result = transaction();
    const duration = Date.now() - startTime;
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT week_start) as total_weeks
      FROM weekly_price_aggregates
    `).get() as { total_rows: number; total_weeks: number };
    
    console.log(`[weekly-aggregation] ✓ Backfill complete: ${stats.total_rows.toLocaleString()} rows across ${stats.total_weeks} weeks in ${duration}ms`);
    
    return {
      weeksUpdated: stats.total_weeks,
      rowsUpdated: stats.total_rows,
      duration
    };
  } catch (error) {
    console.error('[weekly-aggregation] ✗ Backfill failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}
