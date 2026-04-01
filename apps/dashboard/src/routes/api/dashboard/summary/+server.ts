import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDashboardSummary, getLastRefreshTime, getDataFreshness, type DashboardFilters } from '@fuelnsw/shared/db/regions';
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

    // Generate cache key
    const cacheKey = `summary:${JSON.stringify(filters)}`;

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

    // Get summary
    const summary = getDashboardSummary(filters);

    const response = {
      lastUpdated,
      dataFreshness: getDataFreshness(lastUpdated),
      summary
    };

    // Cache the response
    setCachedStats(cacheKey, response);

    return json(response);
  } catch (error) {
    console.error('[dashboard/summary] Error:', error instanceof Error ? error.message : error);
    return json(
      { error: 'Failed to load summary data' },
      { status: 500 }
    );
  }
};
