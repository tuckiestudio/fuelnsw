<script lang="ts">
  import type { RegionInfo, BrandInfo } from '@fuelnsw/shared/db/regions';

  interface Filters {
    regions: string[];
    brands: string[];
    fuels: string[];
  }

  let { regions, brands, filters, onUpdate }: { 
    regions: RegionInfo[]; 
    brands: BrandInfo[];
    filters: Filters;
    onUpdate: (filters: Filters) => void;
  } = $props();
  
  const FUEL_COLORS: Record<string, string> = {
    'Diesel': '#3b82f6',
    'Unleaded': '#22c55e',
    'E10': '#84cc16',
    'P95': '#f59e0b',
    'P98': '#ef4444',
    'LPG': '#8b5cf6'
  };

  function handleUpdate() {
    onUpdate({
      regions: filters.regions,
      brands: filters.brands,
      fuels: filters.fuels
    });
  }

  function toggleRegion(region: string) {
    const index = filters.regions.indexOf(region);
    if (index > -1) {
      filters.regions.splice(index, 1);
    } else {
      filters.regions.push(region);
    }
    handleUpdate();
  }

  function toggleBrand(brand: string) {
    const index = filters.brands.indexOf(brand);
    if (index > -1) {
      filters.brands.splice(index, 1);
    } else {
      filters.brands.push(brand);
    }
    handleUpdate();
  }

  function toggleFuel(fuel: string) {
    const index = filters.fuels.indexOf(fuel);
    if (index > -1) {
      filters.fuels.splice(index, 1);
    } else {
      filters.fuels.push(fuel);
    }
    handleUpdate();
  }

  function selectAllRegions() {
    filters.regions = regions.map(r => r.sa4_region);
    handleUpdate();
  }

  function clearRegions() {
    filters.regions = [];
    handleUpdate();
  }

  function selectAllBrands() {
    filters.brands = brands.map(b => b.brand);
    handleUpdate();
  }

  function clearBrands() {
    filters.brands = [];
    handleUpdate();
  }

  function selectAllFuels() {
    filters.fuels = ['Diesel', 'Unleaded', 'E10', 'P95', 'P98', 'LPG'];
    handleUpdate();
  }

  function clearFuels() {
    filters.fuels = [];
    handleUpdate();
  }

  function isSelected(arr: string[], value: string): boolean {
    return arr.includes(value);
  }
</script>

<div class="space-y-4">
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <!-- Regions -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-sm text-gray-700">Regions</h3>
        <div class="flex gap-1">
          <button 
            onclick={selectAllRegions}
            class="text-xs text-green-600 hover:text-green-700 hover:underline"
          >
            All
          </button>
          <span class="text-gray-300">|</span>
          <button 
            onclick={clearRegions}
            class="text-xs text-gray-500 hover:text-gray-700 hover:underline"
          >
            Clear
          </button>
        </div>
      </div>
      <div class="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-md p-2 bg-white">
        {#each regions as region}
          <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
            <input 
              type="checkbox" 
              checked={isSelected(filters.regions, region.sa4_region)}
              onchange={() => toggleRegion(region.sa4_region)}
              class="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span class="flex-1 truncate">{region.sa4_region}</span>
            <span class="text-xs text-gray-400">{region.station_count}</span>
          </label>
        {/each}
      </div>
    </div>
    
    <!-- Brands -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-sm text-gray-700">Brands</h3>
        <div class="flex gap-1">
          <button 
            onclick={selectAllBrands}
            class="text-xs text-green-600 hover:text-green-700 hover:underline"
          >
            All
          </button>
          <span class="text-gray-300">|</span>
          <button 
            onclick={clearBrands}
            class="text-xs text-gray-500 hover:text-gray-700 hover:underline"
          >
            Clear
          </button>
        </div>
      </div>
      <div class="max-h-48 overflow-y-auto space-y-1 border border-gray-200 rounded-md p-2 bg-white">
        {#each brands as brand}
          <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
            <input 
              type="checkbox" 
              checked={isSelected(filters.brands, brand.brand)}
              onchange={() => toggleBrand(brand.brand)}
              class="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span class="flex-1 truncate">
              {brand.brand}
              {#if brand.is_group}
                <span class="text-xs text-gray-400 ml-1">({brand.sub_brands?.length || 0} sub)</span>
              {/if}
            </span>
            <span class="text-xs text-gray-400">{brand.station_count}</span>
          </label>
        {/each}
      </div>
    </div>
    
    <!-- Fuel Types -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-sm text-gray-700">Fuel Types</h3>
        <div class="flex gap-1">
          <button 
            onclick={selectAllFuels}
            class="text-xs text-green-600 hover:text-green-700 hover:underline"
          >
            All
          </button>
          <span class="text-gray-300">|</span>
          <button 
            onclick={clearFuels}
            class="text-xs text-gray-500 hover:text-gray-700 hover:underline"
          >
            Clear
          </button>
        </div>
      </div>
      <div class="space-y-1 border border-gray-200 rounded-md p-2 bg-white">
        {#each ['Diesel', 'Unleaded', 'E10', 'P95', 'P98', 'LPG'] as fuel}
          <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
            <input 
              type="checkbox" 
              checked={isSelected(filters.fuels, fuel)}
              onchange={() => toggleFuel(fuel)}
              class="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span class="w-3 h-3 rounded-full" style="background: {FUEL_COLORS[fuel]}"></span>
            <span>{fuel}</span>
          </label>
        {/each}
      </div>
    </div>
  </div>
</div>
