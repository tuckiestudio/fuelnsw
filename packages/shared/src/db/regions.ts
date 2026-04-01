import { getDb } from './client.js';

export interface WeeklyAggregate {
  week_start: string;
  sa4_region: string;
  brand_group: string;
  fuel_type: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  station_count: number;
}

export interface DashboardFilters {
  regions?: string[];
  brands?: string[];
  fuels?: string[];
  months?: number;
}

export interface RegionInfo {
  sa4_region: string;
  station_count: number;
  has_data: boolean;
}

export interface BrandInfo {
  brand: string;
  is_group: boolean;
  sub_brands?: string[];
  station_count: number;
}

export interface FuelTypeStats {
  fuel_type: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  station_count: number;
  byRegion: Array<{ region: string; avg_price: number }>;
}

export interface BrandStats {
  brand: string;
  is_group: boolean;
  sub_brands?: Array<{ name: string; count: number }>;
  avg_price: number;
  min_price: number;
  max_price: number;
  station_count: number;
  byRegion: Array<{ region: string; avg_price: number }>;
}

export interface DashboardSummary {
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  stationCount: number;
  minLocation: string;
  maxLocation: string;
}

export function getSA4Regions(): RegionInfo[] {
  const db = getDb();
  
  const stationRows = db.prepare(`
    SELECT 
      pcm.sa4_region,
      COUNT(DISTINCT s.code) as station_count
    FROM postcode_sa4_mapping pcm
    LEFT JOIN stations s ON pcm.postcode = s.postcode
    GROUP BY pcm.sa4_region
  `).all() as Array<{ sa4_region: string; station_count: number }>;

  const dataRegions = db.prepare(`
    SELECT DISTINCT sa4_region FROM weekly_price_aggregates
  `).all() as Array<{ sa4_region: string }>;
  
  const hasData = new Set(dataRegions.map(r => r.sa4_region));
  
  return stationRows.map(row => ({
    sa4_region: row.sa4_region,
    station_count: row.station_count,
    has_data: hasData.has(row.sa4_region)
  })).sort((a, b) => a.sa4_region.localeCompare(b.sa4_region));
}

export function getBrands(): BrandInfo[] {
  const db = getDb();
  
  const groupRows = db.prepare(`
    SELECT 
      brand_group,
      COUNT(DISTINCT code) as station_count
    FROM stations
    WHERE brand_group IN ('Ampol', 'Caltex', 'Independent')
    GROUP BY brand_group
  `).all() as Array<{ brand_group: string; station_count: number }>;
  
  const standaloneRows = db.prepare(`
    SELECT 
      brand_group,
      GROUP_CONCAT(DISTINCT brand) as brands,
      COUNT(DISTINCT code) as station_count
    FROM stations
    WHERE brand_group NOT IN ('Ampol', 'Caltex', 'Independent')
      AND brand_group IS NOT NULL
      AND brand_group != ''
    GROUP BY brand_group
    HAVING COUNT(DISTINCT code) >= 100
    ORDER BY station_count DESC
  `).all() as Array<{ brand_group: string; brands: string; station_count: number }>;
  
  const otherBrandsCount = db.prepare(`
    SELECT COUNT(DISTINCT code) as station_count
    FROM stations
    WHERE brand_group NOT IN ('Ampol', 'Caltex', 'Independent', '')
    GROUP BY brand_group
    HAVING COUNT(DISTINCT code) < 100
  `).all() as Array<{ station_count: number }>;
  
  const totalOtherBrands = otherBrandsCount.reduce((sum, row) => sum + row.station_count, 0);
  
  const results: BrandInfo[] = [];
  
  for (const row of groupRows) {
    const subBrands = getSubBrandsForRow(row.brand_group);
    results.push({
      brand: row.brand_group,
      is_group: true,
      sub_brands: subBrands,
      station_count: row.station_count
    });
  }
  
  for (const row of standaloneRows) {
    const brands = row.brands.split(',').filter(Boolean);
    results.push({
      brand: row.brand_group,
      is_group: brands.length > 1,
      sub_brands: brands.length > 1 ? brands : undefined,
      station_count: row.station_count
    });
  }
  
  if (totalOtherBrands > 0) {
    results.push({
      brand: 'Other Brands',
      is_group: true,
      sub_brands: ['Small brands (<100 stations)'],
      station_count: totalOtherBrands
    });
  }
  
  return results.sort((a, b) => {
    return b.station_count - a.station_count;
  });
}

function getSubBrandsForRow(group: string): string[] {
  const BRAND_GROUPS: Record<string, string[]> = {
    'Ampol': ['Ampol', 'EG Ampol', 'Ampol Foodary', 'Ampol Breeze', 'EBM Ampol'],
    'Caltex': ['Caltex', 'Caltex Woolworths'],
    'Independent': ['Independent', 'Independent EV']
  };
  return BRAND_GROUPS[group] || [];
}

export function getWeeklyAggregates(filters: DashboardFilters = {}): WeeklyAggregate[] {
  const db = getDb();
  
  const {
    regions = [],
    brands = [],
    fuels = [],
    months = 12
  } = filters;
  
  let dateFilter = '';
  const params: any[] = [];
  
  if (months > 0) {
    dateFilter = "AND wpa.week_start >= DATE('now', ?)";
    params.push(`-${months} months`);
  }
  
  const regionFilter = regions.length > 0 
    ? `AND wpa.sa4_region IN (${regions.map(() => '?').join(',')})` 
    : '';
  params.push(...regions);
  
  const brandFilter = brands.length > 0
    ? `AND wpa.brand_group IN (${brands.map(() => '?').join(',')})`
    : '';
  params.push(...brands);
  
  const fuelFilter = fuels.length > 0
    ? `AND wpa.fuel_type IN (${fuels.map(() => '?').join(',')})`
    : '';
  params.push(...fuels);
  
  const query = `
    SELECT 
      wpa.week_start,
      wpa.sa4_region,
      wpa.brand_group,
      wpa.fuel_type,
      wpa.avg_price,
      wpa.min_price,
      wpa.max_price,
      wpa.station_count
    FROM weekly_price_aggregates wpa
    WHERE 1=1 ${dateFilter} ${regionFilter} ${brandFilter} ${fuelFilter}
    ORDER BY wpa.week_start DESC, wpa.sa4_region, wpa.brand_group, wpa.fuel_type
  `;
  
  return db.prepare(query).all(...params) as WeeklyAggregate[];
}

export function getDashboardSummary(filters: DashboardFilters = {}): DashboardSummary {
  const db = getDb();
  
  const {
    regions = [],
    brands = [],
    fuels = [],
    months = 12
  } = filters;
  
  let dateFilter = '';
  const params: any[] = [];
  
  if (months > 0) {
    dateFilter = "week_start >= DATE('now', ?)";
    params.push(`-${months} months`);
  }
  
  const conditions: string[] = [];
  
  if (dateFilter) {
    conditions.push(dateFilter);
  }
  if (regions.length > 0) {
    conditions.push(`sa4_region IN (${regions.map(() => '?').join(',')})`);
    params.push(...regions);
  }

  if (brands.length > 0) {
    conditions.push(`brand_group IN (${brands.map(() => '?').join(',')})`);
    params.push(...brands);
  }

  if (fuels.length > 0) {
    conditions.push(`fuel_type IN (${fuels.map(() => '?').join(',')})`);
    params.push(...fuels);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  
  const row = db.prepare(`
    SELECT 
      AVG(avg_price) as avg_price,
      MIN(min_price) as min_price,
      MAX(max_price) as max_price,
      SUM(station_count) as station_count
    FROM weekly_price_aggregates
    ${whereClause}
  `).get(...params) as {
    avg_price: number;
    min_price: number;
    max_price: number;
    station_count: number;
  };
  
  const minRow = db.prepare(`
    SELECT sa4_region, brand_group, fuel_type, min_price
    FROM weekly_price_aggregates
    ${whereClause}
    ORDER BY min_price ASC
    LIMIT 1
  `).get(...params) as { sa4_region: string; brand_group: string; fuel_type: string } | undefined;
  
  const maxRow = db.prepare(`
    SELECT sa4_region, brand_group, fuel_type, max_price
    FROM weekly_price_aggregates
    ${whereClause}
    ORDER BY max_price DESC
    LIMIT 1
  `).get(...params) as { sa4_region: string; brand_group: string; fuel_type: string } | undefined;
  
  return {
    avgPrice: row.avg_price ? Math.round(row.avg_price * 10) / 10 : 0,
    minPrice: row.min_price ? Math.round(row.min_price * 10) / 10 : 0,
    maxPrice: row.max_price ? Math.round(row.max_price * 10) / 10 : 0,
    stationCount: row.station_count || 0,
    minLocation: minRow ? `${minRow.brand_group} (${minRow.sa4_region})` : 'N/A',
    maxLocation: maxRow ? `${maxRow.brand_group} (${maxRow.sa4_region})` : 'N/A'
  };
}

export function getFuelTypeStats(filters: DashboardFilters = {}): FuelTypeStats[] {
  const db = getDb();
  
  const {
    regions = [],
    brands = [],
    fuels = [],
    months = 12
  } = filters;
  
  let dateFilter = '';
  const params: any[] = [];
  
  if (months > 0) {
    dateFilter = "week_start >= DATE('now', ?)";
    params.push(`-${months} months`);
  }
  
  const conditions: string[] = [];
  
  if (dateFilter) {
    conditions.push(dateFilter);
  }
  if (regions.length > 0) {
    conditions.push(`sa4_region IN (${regions.map(() => '?').join(',')})`);
    params.push(...regions);
  }

  if (brands.length > 0) {
    conditions.push(`brand_group IN (${brands.map(() => '?').join(',')})`);
    params.push(...brands);
  }

  if (fuels.length > 0) {
    conditions.push(`fuel_type IN (${fuels.map(() => '?').join(',')})`);
    params.push(...fuels);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const fuelRows = db.prepare(`
    SELECT 
      fuel_type,
      AVG(avg_price) as avg_price,
      MIN(min_price) as min_price,
      MAX(max_price) as max_price,
      SUM(station_count) as station_count
    FROM weekly_price_aggregates
    ${whereClause}
    GROUP BY fuel_type
    ORDER BY fuel_type
  `).all(...params) as Array<{
    fuel_type: string;
    avg_price: number;
    min_price: number;
    max_price: number;
    station_count: number;
  }>;
  
  const regionParams = [...params];
  const byRegionQuery = `
    SELECT 
      fuel_type,
      sa4_region,
      AVG(avg_price) as avg_price
    FROM weekly_price_aggregates
    ${whereClause}
    GROUP BY fuel_type, sa4_region
    ORDER BY fuel_type, sa4_region
  `;
  
  const byRegionRows = db.prepare(byRegionQuery).all(...regionParams) as Array<{
    fuel_type: string;
    sa4_region: string;
    avg_price: number;
  }>;
  
  const result = new Map<string, FuelTypeStats>();
  
  for (const row of fuelRows) {
    result.set(row.fuel_type, {
      fuel_type: row.fuel_type,
      avg_price: Math.round(row.avg_price * 10) / 10,
      min_price: Math.round(row.min_price * 10) / 10,
      max_price: Math.round(row.max_price * 10) / 10,
      station_count: row.station_count,
      byRegion: []
    });
  }
  
  for (const row of byRegionRows) {
    const stats = result.get(row.fuel_type);
    if (stats) {
      stats.byRegion.push({
        region: row.sa4_region,
        avg_price: Math.round(row.avg_price * 10) / 10
      });
    }
  }
  
  return Array.from(result.values());
}

export function getBrandStats(filters: DashboardFilters = {}): BrandStats[] {
  const db = getDb();
  
  const {
    regions = [],
    brands = [],
    fuels = [],
    months = 12
  } = filters;
  
  let dateFilter = '';
  const params: any[] = [];
  
  if (months > 0) {
    dateFilter = "week_start >= DATE('now', ?)";
    params.push(`-${months} months`);
  }
  
  const conditions: string[] = [];
  
  if (dateFilter) {
    conditions.push(dateFilter);
  }
  if (regions.length > 0) {
    conditions.push(`sa4_region IN (${regions.map(() => '?').join(',')})`);
    params.push(...regions);
  }

  if (brands.length > 0) {
    conditions.push(`brand_group IN (${brands.map(() => '?').join(',')})`);
    params.push(...brands);
  }

  if (fuels.length > 0) {
    conditions.push(`fuel_type IN (${fuels.map(() => '?').join(',')})`);
    params.push(...fuels);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const brandRows = db.prepare(`
    SELECT 
      brand_group,
      AVG(avg_price) as avg_price,
      MIN(min_price) as min_price,
      MAX(max_price) as max_price,
      SUM(station_count) as station_count
    FROM weekly_price_aggregates
    ${whereClause}
    GROUP BY brand_group
    ORDER BY brand_group
  `).all(...params) as Array<{
    brand_group: string;
    avg_price: number;
    min_price: number;
    max_price: number;
    station_count: number;
  }>;
  
  const byRegionQuery = `
    SELECT 
      brand_group,
      sa4_region,
      AVG(avg_price) as avg_price
    FROM weekly_price_aggregates
    ${whereClause}
    GROUP BY brand_group, sa4_region
    ORDER BY brand_group, sa4_region
  `;
  
  const byRegionRows = db.prepare(byRegionQuery).all(...params) as Array<{
    brand_group: string;
    sa4_region: string;
    avg_price: number;
  }>;
  
  const BRAND_GROUPS: Record<string, string[]> = {
    'Ampol': ['Ampol', 'EG Ampol', 'Ampol Foodary', 'Ampol Breeze', 'EBM Ampol'],
    'Caltex': ['Caltex', 'Caltex Woolworths'],
    'Independent': ['Independent', 'Independent EV']
  };
  
  const result = new Map<string, BrandStats>();
  
  for (const row of brandRows) {
    const isGroup = row.brand_group in BRAND_GROUPS;
    const subBrands = isGroup ? BRAND_GROUPS[row.brand_group].map(name => ({
      name,
      count: 0
    })) : undefined;
    
    result.set(row.brand_group, {
      brand: row.brand_group,
      is_group: isGroup,
      sub_brands: subBrands,
      avg_price: Math.round(row.avg_price * 10) / 10,
      min_price: Math.round(row.min_price * 10) / 10,
      max_price: Math.round(row.max_price * 10) / 10,
      station_count: row.station_count,
      byRegion: []
    });
  }
  
  for (const row of byRegionRows) {
    const stats = result.get(row.brand_group);
    if (stats) {
      stats.byRegion.push({
        region: row.sa4_region,
        avg_price: Math.round(row.avg_price * 10) / 10
      });
    }
  }
  
  return Array.from(result.values());
}

export function getLastRefreshTime(): string | null {
  const db = getDb();
  
  const row = db.prepare('SELECT fetched_at FROM refresh_log ORDER BY id DESC LIMIT 1').get() as { fetched_at: string } | undefined;
  return row?.fetched_at || null;
}

export function getDataFreshness(lastUpdated: string): 'fresh' | 'stale' | 'old' {
  const hours = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60);
  
  if (hours < 12) return 'fresh';
  if (hours < 24) return 'stale';
  return 'old';
}
