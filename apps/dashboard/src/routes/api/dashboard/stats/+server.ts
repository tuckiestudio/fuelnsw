import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  getWeeklyAggregates,
  getDashboardSummary,
  getFuelTypeStats,
  getBrandStats,
  getLastRefreshTime,
  getDataFreshness,
  type DashboardFilters
} from '@fuelnsw/shared/db/regions';
import { getCachedStats, setCachedStats } from '@fuelnsw/shared/cache';

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Parse filters from URL
    const filters: DashboardFilters = {
      regions: url.searchParams.getAll('regions'),
      brands: url.searchParams.getAll('brands'),
      fuels: url.searchParams.getAll('fuels'),
      months: parseInt(url.searchParams.get('months') || '12'),
    };

    // Validate limits
    const MAX_REGIONS = 5;
    const MAX_BRANDS = 10;
    const MAX_DATA_POINTS = 50000;

    const regions = filters.regions || [];
    const brands = filters.brands || [];

    if (regions.length > MAX_REGIONS) {
      return json(
        { error: `Maximum ${MAX_REGIONS} regions allowed at once` },
        { status: 400 }
      );
    }

    if (brands.length > MAX_BRANDS) {
      return json(
        { error: `Maximum ${MAX_BRANDS} brands allowed at once` },
        { status: 400 }
      );
    }

    // Generate cache key
    const cacheKey = JSON.stringify(filters);

    // Check cache
    const cached = getCachedStats(cacheKey);
    if (cached) {
      return json(cached);
    }

    // Get last refresh time
    const lastUpdated = getLastRefreshTime();
    if (!lastUpdated) {
      return json(
        { error: 'No data available. Please run the data refresh first.' },
        { status: 503 }
      );
    }

    // Get data with error handling
    let summary, byFuelType, byBrand, historical;
    
    try {
      summary = getDashboardSummary(filters);
    } catch (e) {
      console.error('[dashboard/stats] Summary error:', e instanceof Error ? e.message : e);
      throw e;
    }
    
    try {
      byFuelType = getFuelTypeStats(filters);
    } catch (e) {
      console.error('[dashboard/stats] FuelType error:', e instanceof Error ? e.message : e);
      throw e;
    }
    
    try {
      byBrand = getBrandStats(filters);
    } catch (e) {
      console.error('[dashboard/stats] Brand error:', e instanceof Error ? e.message : e);
      throw e;
    }
    
    try {
      historical = getWeeklyAggregates(filters);
    } catch (e) {
      console.error('[dashboard/stats] Historical error:', e instanceof Error ? e.message : e);
      throw e;
    }

    // Validate result size
    if (historical.length > MAX_DATA_POINTS) {
      return json(
        {
          error: 'Too much data returned. Add more filters to reduce results.',
          rowCount: historical.length,
          maxAllowed: MAX_DATA_POINTS
        },
        { status: 400 }
      );
    }

    // Build response
    const response = {
      lastUpdated,
      dataFreshness: getDataFreshness(lastUpdated),
      summary,
      byFuelType,
      byBrand,
      historical,
      filters: {
        regions: filters.regions,
        brands: filters.brands,
        fuels: filters.fuels,
        months: filters.months
      }
    };

    // Cache the response
    setCachedStats(cacheKey, response);

    return json(response);
  } catch (error) {
    console.error('[dashboard/stats] Error:', error instanceof Error ? error.message : error);
    return json(
      { error: 'Failed to load dashboard data. Please try again later.' },
      { status: 500 }
    );
  }
};
