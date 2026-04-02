<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import FilterPanel from '$components/dashboard/FilterPanel.svelte';
  import TimeRangeSelector from '$components/dashboard/TimeRangeSelector.svelte';
  import ChartViewToggle from '$components/dashboard/ChartViewToggle.svelte';
  import SummaryCards from '$components/dashboard/SummaryCards.svelte';
  import DataFreshnessBadge from '$components/dashboard/DataFreshnessBadge.svelte';
  import FuelTypeChart from '$components/dashboard/FuelTypeChart.svelte';
  import BrandChart from '$components/dashboard/BrandChart.svelte';
  import RegionalMap from '$components/dashboard/RegionalMap.svelte';

  interface RegionInfo {
    sa4_region: string;
    station_count: number;
    has_data: boolean;
  }

  interface BrandInfo {
    brand: string;
    is_group: boolean;
    sub_brands?: string[];
    station_count: number;
  }

  interface DashboardStats {
    lastUpdated: string;
    dataFreshness: 'fresh' | 'stale' | 'old';
    summary: {
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      stationCount: number;
      minLocation: string;
      maxLocation: string;
    };
    byFuelType: Array<{
      fuel_type: string;
      avg_price: number;
      min_price: number;
      max_price: number;
      station_count: number;
      byRegion: Array<{ region: string; avg_price: number }>;
    }>;
    byBrand: Array<{
      brand: string;
      is_group: boolean;
      sub_brands?: Array<{ name: string; count: number }>;
      avg_price: number;
      min_price: number;
      max_price: number;
      station_count: number;
      byRegion: Array<{ region: string; avg_price: number }>;
    }>;
    historical: Array<{
      week_start: string;
      sa4_region: string;
      brand_group: string;
      fuel_type: string;
      avg_price: number;
      min_price: number;
      max_price: number;
      station_count: number;
    }>;
  }

  interface Filters {
    regions: string[];
    brands: string[];
    fuels: string[];
    months: number;
    view: 'bar' | 'line';
  }

  // Initialize from URL
  const params = new URLSearchParams($page.url.search);
  let filters = $state<Filters>({
    regions: params.getAll('regions'),
    brands: params.getAll('brands'),
    fuels: params.getAll('fuels'),
    months: parseInt(params.get('months') || '12'),
    view: (params.get('view') as 'bar' | 'line') || 'bar'
  });
  
  let regions = $state<RegionInfo[]>([]);
  let brands = $state<BrandInfo[]>([]);
  let stats = $state<DashboardStats | null>(null);
  let loading = $state(true);
  let error = $state('');

  // Derived values for charts to ensure reactivity
  let fuelChartData = $derived(stats?.byFuelType || []);
  let brandChartData = $derived(stats?.byBrand || []);
  let summaryData = $derived(stats?.summary || null);
  let chartRegions = $derived(filters.regions.length > 0 ? filters.regions : ['All NSW']);

  async function loadRegionsAndBrands() {
    try {
      const [regionsRes, brandsRes] = await Promise.all([
        fetch('/api/dashboard/regions'),
        fetch('/api/dashboard/brands')
      ]);
      
      if (regionsRes.ok) {
        regions = await regionsRes.json();
      }
      
      if (brandsRes.ok) {
        brands = await brandsRes.json();
      }
    } catch (err) {
      console.error('Failed to load regions/brands:', err);
    }
  }

  async function loadStats() {
    loading = true;
    error = '';
    
    try {
      const urlParams = new URLSearchParams();
      filters.regions.forEach(r => urlParams.append('regions', r));
      filters.brands.forEach(b => urlParams.append('brands', b));
      filters.fuels.forEach(f => urlParams.append('fuels', f));
      urlParams.set('months', String(filters.months));
      urlParams.set('view', filters.view);
      
      const res = await fetch(`/api/dashboard/stats?${urlParams}`);
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to load data');
      }
      
      const newStats = await res.json();
      // Use structuredClone to break proxy references and ensure reactivity
      stats = structuredClone(newStats);
    } catch (e) {
      console.error('[Dashboard] Failed to load stats:', e);
      error = e instanceof Error ? e.message : 'Load failed';
      stats = null;
    }
    
    loading = false;
  }

  function updateFilters(newFilters: Partial<Filters>) {
    // Create new arrays to ensure reactivity
    if (newFilters.regions) {
      filters.regions = [...newFilters.regions];
    }
    if (newFilters.brands) {
      filters.brands = [...newFilters.brands];
    }
    if (newFilters.fuels) {
      filters.fuels = [...newFilters.fuels];
    }
    if (newFilters.months) {
      filters.months = newFilters.months;
    }
    if (newFilters.view) {
      filters.view = newFilters.view;
    }
    
    // Update URL (for sharing)
    const urlParams = new URLSearchParams();
    filters.regions.forEach(r => urlParams.append('regions', r));
    filters.brands.forEach(b => urlParams.append('brands', b));
    filters.fuels.forEach(f => urlParams.append('fuels', f));
    urlParams.set('months', String(filters.months));
    urlParams.set('view', filters.view);
    
    goto(`?${urlParams}`, { replaceState: true });
    
    // Load new stats
    loadStats();
  }

  function handleRegionClick(region: string) {
    const newRegions = filters.regions.includes(region)
      ? filters.regions.filter(r => r !== region)
      : [...filters.regions, region];
    
    updateFilters({ regions: newRegions });
  }

  onMount(async () => {
    await loadRegionsAndBrands();
    await loadStats();
  });
</script>

<div class="p-4 lg:p-8 space-y-6">
  <!-- Header -->
  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">NSW Fuel Price Dashboard</h1>
      <p class="text-sm text-gray-500 mt-1">Compare prices across SA4 regions</p>
    </div>
    {#if stats}
      <DataFreshnessBadge lastUpdated={stats.lastUpdated} />
    {/if}
  </div>
  
  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-4 border border-gray-200 space-y-4">
    {#if regions.length > 0 && brands.length > 0}
      <FilterPanel 
        {regions}
        {brands}
        filters={{
          regions: filters.regions,
          brands: filters.brands,
          fuels: filters.fuels
        }}
        onUpdate={(newFilters) => updateFilters(newFilters)}
      />
    {:else}
      <div class="flex items-center justify-center h-32">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    {/if}
    
    <div class="flex items-center justify-between pt-2 border-t border-gray-200">
      <TimeRangeSelector value={filters.months} onChange={(m) => updateFilters({ months: m })} />
      <ChartViewToggle value={filters.view} onChange={(v) => updateFilters({ view: v })} />
    </div>
  </div>
  
  <!-- Regional Map -->
  <RegionalMap 
    selectedRegions={filters.regions} 
    onRegionClick={handleRegionClick} 
  />
  
  <!-- Loading State -->
  {#if loading}
    <div class="flex items-center justify-center h-64 bg-white rounded-lg border border-gray-200">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p class="text-gray-600">Loading dashboard data...</p>
      </div>
    </div>
  {/if}
  
  <!-- Error State -->
  {#if error}
    <div class="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p class="font-semibold">Dashboard unavailable</p>
          <p class="text-sm mt-1">{error}</p>
          <p class="text-sm mt-2">Please contact support to resolve this issue.</p>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Summary Cards & Charts -->
  {#if summaryData && !loading && !error}
    <!-- Summary Cards -->
    <SummaryCards summary={summaryData} />
    
    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-lg shadow p-4 border border-gray-200">
        <h2 class="font-semibold text-gray-900 mb-4">Average Price by Fuel Type</h2>
        <FuelTypeChart 
          data={fuelChartData} 
          view={filters.view} 
          regions={chartRegions} 
        />
      </div>
      
      <div class="bg-white rounded-lg shadow p-4 border border-gray-200">
        <h2 class="font-semibold text-gray-900 mb-4">Average Price by Brand</h2>
        <BrandChart 
          data={brandChartData} 
          view={filters.view} 
          regions={chartRegions} 
        />
      </div>
    </div>
  {/if}
</div>
