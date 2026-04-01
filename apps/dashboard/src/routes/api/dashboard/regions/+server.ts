import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSA4Regions } from '@fuelnsw/shared/db/regions';

export const GET: RequestHandler = async () => {
  try {
    const regions = getSA4Regions();
    return json(regions);
  } catch (error) {
    console.error('[dashboard/regions] Error:', error instanceof Error ? error.message : error);
    return json(
      { error: 'Failed to load regions' },
      { status: 500 }
    );
  }
};
