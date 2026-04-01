import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrands } from '@fuelnsw/shared/db/regions';

export const GET: RequestHandler = async () => {
  try {
    const brands = getBrands();
    return json(brands);
  } catch (error) {
    console.error('[dashboard/brands] Error:', error instanceof Error ? error.message : error);
    return json(
      { error: 'Failed to load brands' },
      { status: 500 }
    );
  }
};
