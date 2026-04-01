<script lang="ts">
  import type { DashboardSummary } from '@fuelnsw/shared/db/regions';

  let { summary }: { summary: DashboardSummary } = $props();
</script>

<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <div class="bg-white rounded-lg shadow p-4 border border-gray-200">
    <div class="text-sm text-gray-500 mb-1">Average Price</div>
    <div class="text-2xl font-bold text-gray-900">{summary.avgPrice.toFixed(1)} c/L</div>
    <div class="text-xs text-gray-400 mt-1">Across all selected</div>
  </div>
  
  <div class="bg-white rounded-lg shadow p-4 border border-gray-200">
    <div class="text-sm text-gray-500 mb-1">Min Price</div>
    <div class="text-2xl font-bold text-green-600">{summary.minPrice.toFixed(1)} c/L</div>
    <div class="text-xs text-gray-400 mt-1 truncate" title={summary.minLocation}>{summary.minLocation}</div>
  </div>
  
  <div class="bg-white rounded-lg shadow p-4 border border-gray-200">
    <div class="text-sm text-gray-500 mb-1">Max Price</div>
    <div class="text-2xl font-bold text-red-600">{summary.maxPrice.toFixed(1)} c/L</div>
    <div class="text-xs text-gray-400 mt-1 truncate" title={summary.maxLocation}>{summary.maxLocation}</div>
  </div>
  
  <div class="bg-white rounded-lg shadow p-4 border border-gray-200">
    <div class="text-sm text-gray-500 mb-1">Stations</div>
    <div class="text-2xl font-bold text-gray-900">{summary.stationCount.toLocaleString()}</div>
    <div class="text-xs text-gray-400 mt-1">Reporting data</div>
  </div>
</div>
