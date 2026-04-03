<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { FUEL_OPTIONS, FUEL_LABELS, FUEL_COLORS } from '@fuelnsw/shared/utils/fuel-types';
	import type { DryStation, OfflineStation, FuelTypeAvailability, AvailabilityTrendPoint } from '@fuelnsw/shared/api/types';

	interface SummaryStats {
		totalStations: number;
		stationsWithPrices: number;
		totalPrices: number;
		avgPrices: Record<string, number>;
		historicalAvgPrices: Record<string, { avg: number; min: number; max: number; days: number }>;
		dryCount: number;
		offlineCount: number;
		lastRefresh: string | null;
	}

	let stats = $state<SummaryStats | null>(null);
	let dryStations = $state<DryStation[]>([]);
	let offlineStations = $state<OfflineStation[]>([]);
	let fuelAvailability = $state<FuelTypeAvailability[]>([]);
	let trend = $state<AvailabilityTrendPoint[]>([]);
	let loading = $state(true);
	let selectedFuelFilter = $state('');
	let error = $state('');
	let trendCanvas = $state<HTMLCanvasElement | undefined>(undefined);
	let trendChart: any;

	let chartJsLoaded = false;

	async function ensureChartJs() {
		if (chartJsLoaded) return;
		const { Chart, registerables } = await import('chart.js');
		Chart.register(...registerables);
		chartJsLoaded = true;
	}

	onMount(async () => {
		await loadData();
	});

	onDestroy(() => {
		if (trendChart) trendChart.destroy();
	});

	async function loadData(fuelFilter?: string) {
		loading = true;
		error = '';
		try {
			const params = new URLSearchParams();
			if (fuelFilter) params.set('fuel', fuelFilter);
			params.set('trend', 'true');
			const res = await fetch(`/api/dry-stations?${params}`);
			const data = await res.json();
			stats = data.stats;
			dryStations = data.dryStations;
			offlineStations = data.offlineStations;
			fuelAvailability = data.fuelAvailability;
			trend = data.trend ?? [];
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load data';
		}
		loading = false;
	}

	function onFuelFilterChange(fuel: string) {
		selectedFuelFilter = fuel;
		loadData(fuel || undefined);
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function formatDateTime(dateStr: string): string {
		return new Date(dateStr).toLocaleString('en-AU', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function severityClass(severity: string): string {
		switch (severity) {
			case 'recent': return 'bg-yellow-100 text-yellow-800';
			case 'warning': return 'bg-orange-100 text-orange-800';
			case 'critical': return 'bg-red-100 text-red-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	}

	function severityLabel(severity: string): string {
		switch (severity) {
			case 'recent': return 'Recent';
			case 'warning': return 'Warning';
			case 'critical': return 'Critical';
			default: return severity;
		}
	}

	$effect(() => {
		if (trendCanvas && trend.length > 0 && !loading) {
			renderTrendChart();
		}
	});

	async function renderTrendChart() {
		await ensureChartJs();
		const { Chart } = await import('chart.js');

		if (trendChart) trendChart.destroy();
		if (!trendCanvas) return;

		const labels = trend.map(t => {
			const d = new Date(t.date + 'T00:00:00');
			return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
		});

		trendChart = new Chart(trendCanvas, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						label: 'Fuel types added',
						data: trend.map(t => t.added),
						backgroundColor: '#22c55e',
						borderRadius: 3,
						barPercentage: 0.7
					},
					{
						label: 'Fuel types dropped',
						data: trend.map(t => -t.dropped),
						backgroundColor: '#ef4444',
						borderRadius: 3,
						barPercentage: 0.7
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'bottom',
						labels: { font: { size: 11 }, boxWidth: 12, padding: 16 }
					},
					tooltip: {
						callbacks: {
							label: (ctx) => {
								const val = Math.abs(ctx.parsed.y as number);
								return val > 0 ? `${ctx.dataset.label}: ${val}` : '';
							}
						}
					}
				},
				scales: {
					x: {
						stacked: true,
						ticks: { maxTicksLimit: 14, font: { size: 10 } },
						grid: { display: false }
					},
					y: {
						stacked: true,
						ticks: {
							callback: (val) => Math.abs(val as number).toString(),
							font: { size: 10 }
						},
						grid: { color: 'rgba(0,0,0,0.05)' }
					}
				}
			}
		});
	}
</script>

<svelte:head>
	<title>Fuel Scout NSW — Price Summary &amp; Availability</title>
	<meta name="description" content="NSW fuel price summary with average prices, historical comparisons, and fuel availability monitoring across all stations." />
</svelte:head>

<div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
	<h1 class="text-2xl font-bold text-gray-900">Fuel Price Summary</h1>

	{#if loading}
		<div class="flex items-center justify-center py-20">
			<div class="text-gray-500">Loading summary data...</div>
		</div>
	{:else if error}
		<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
	{:else if stats}
		<!-- Stats Cards -->
		<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<div class="text-sm text-gray-500">Total Stations</div>
				<div class="text-2xl font-bold text-gray-900">{stats.totalStations.toLocaleString()}</div>
			</div>
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<div class="text-sm text-gray-500">Stations Reporting</div>
				<div class="text-2xl font-bold text-green-600">{stats.stationsWithPrices.toLocaleString()}</div>
			</div>
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<div class="text-sm text-gray-500">Total Prices</div>
				<div class="text-2xl font-bold text-gray-900">{stats.totalPrices.toLocaleString()}</div>
			</div>
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<div class="text-sm text-gray-500">Fuel Types Dropped</div>
				<div class="text-2xl font-bold text-red-600">{stats.dryCount}</div>
			</div>
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<div class="text-sm text-gray-500">Stations Offline</div>
				<div class="text-2xl font-bold text-red-800">{stats.offlineCount}</div>
			</div>
		</div>

		<!-- Average Prices -->
		{#if Object.keys(stats.avgPrices).length > 0}
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<h2 class="text-lg font-semibold text-gray-900 mb-3">Average Prices (c/L)</h2>
				<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
					{#each Object.entries(stats.avgPrices) as [fuel, price]}
						<div class="text-center py-2 px-3 bg-gray-50 rounded-md">
							<div class="text-xs text-gray-500">{fuel}</div>
							<div class="text-lg font-bold">{(price as number).toFixed(1)}</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Historical Average Prices -->
		{#if stats.historicalAvgPrices && Object.keys(stats.historicalAvgPrices).length > 0}
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<h2 class="text-lg font-semibold text-gray-900 mb-3">Historical Prices (c/L)</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="bg-gray-50 text-left">
								<th class="px-4 py-2 font-medium text-gray-500">Fuel Type</th>
								<th class="px-4 py-2 font-medium text-gray-500">Average</th>
								<th class="px-4 py-2 font-medium text-gray-500">Min</th>
								<th class="px-4 py-2 font-medium text-gray-500">Max</th>
								<th class="px-4 py-2 font-medium text-gray-500">Days</th>
								<th class="px-4 py-2 font-medium text-gray-500">vs Current</th>
							</tr>
						</thead>
						<tbody>
							{#each Object.entries(stats.historicalAvgPrices) as [fuel, hist]}
								{@const currentPrice = stats.avgPrices[fuel]}
								<tr class="border-t border-gray-100 hover:bg-gray-50">
									<td class="px-4 py-2 font-medium text-gray-900">{fuel}</td>
									<td class="px-4 py-2">{hist.avg.toFixed(1)}</td>
									<td class="px-4 py-2 text-green-600">{hist.min.toFixed(1)}</td>
									<td class="px-4 py-2 text-red-600">{hist.max.toFixed(1)}</td>
									<td class="px-4 py-2 text-gray-500">{hist.days.toLocaleString()}</td>
									<td class="px-4 py-2">
										{#if currentPrice}
											{@const diff = currentPrice - hist.avg}
											<span class="{diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-gray-500'}">
												{diff > 0 ? '+' : ''}{diff.toFixed(1)}
											</span>
										{:else}
											<span class="text-gray-400">&mdash;</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Fuel Availability Grid -->
		{#if fuelAvailability.length > 0}
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<h2 class="text-lg font-semibold text-gray-900 mb-3">Fuel Type Availability</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="bg-gray-50 text-left">
								<th class="px-4 py-2 font-medium text-gray-500">Fuel Type</th>
								<th class="px-4 py-2 font-medium text-gray-500">Active</th>
								<th class="px-4 py-2 font-medium text-gray-500">Dropped</th>
								<th class="px-4 py-2 font-medium text-gray-500">Recently Dropped (48h)</th>
							</tr>
						</thead>
						<tbody>
							{#each fuelAvailability as fa}
								<tr class="border-t border-gray-100 hover:bg-gray-50">
									<td class="px-4 py-2 font-medium text-gray-900">
										<span class="inline-block w-3 h-3 rounded-full mr-2" style="background: {FUEL_COLORS[fa.fuel_type] ?? '#6b7280'}"></span>
										{FUEL_LABELS[fa.fuel_type] ?? fa.fuel_type}
									</td>
									<td class="px-4 py-2 text-green-700 font-medium">{fa.active_count.toLocaleString()}</td>
									<td class="px-4 py-2">
										{#if fa.dry_count > 0}
											<span class="text-red-600 font-medium">{fa.dry_count}</span>
										{:else}
											<span class="text-gray-400">0</span>
										{/if}
									</td>
									<td class="px-4 py-2">
										{#if fa.recently_dropped_count > 0}
											<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
												{fa.recently_dropped_count}
											</span>
										{:else}
											<span class="text-gray-400">0</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Availability Trend Chart -->
		{#if trend.length > 0}
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
				<h2 class="text-lg font-semibold text-gray-900 mb-3">Fuel Availability Trend (14 days)</h2>
				<div class="h-64">
					<canvas bind:this={trendCanvas}></canvas>
				</div>
			</div>
		{/if}

		{#if stats.lastRefresh}
			<div class="text-xs text-gray-400">
				Last data refresh: {new Date(stats.lastRefresh).toLocaleString('en-AU')}
			</div>
		{/if}

		<!-- Offline Stations -->
		{#if offlineStations.length > 0}
			<div class="bg-white rounded-lg shadow-sm border border-red-300 overflow-hidden">
				<div class="p-4 border-b border-red-200 bg-red-50">
					<h2 class="text-lg font-semibold text-red-900">
						Fully Offline Stations
						<span class="text-sm font-normal text-red-600">({offlineStations.length} stopped reporting all fuel types)</span>
					</h2>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="bg-gray-50 text-left">
								<th class="px-4 py-3 font-medium text-gray-500">Station</th>
								<th class="px-4 py-3 font-medium text-gray-500">Suburb</th>
								<th class="px-4 py-3 font-medium text-gray-500">Fuel Types Dropped</th>
								<th class="px-4 py-3 font-medium text-gray-500">Dropped At</th>
								<th class="px-4 py-3 font-medium text-gray-500">Hours Since</th>
							</tr>
						</thead>
						<tbody>
							{#each offlineStations as station}
								<tr class="border-t border-gray-100 hover:bg-red-50">
									<td class="px-4 py-3">
										<div class="font-medium text-gray-900">{station.station_name}</div>
										<div class="text-gray-500">{station.brand}</div>
									</td>
									<td class="px-4 py-3 text-gray-700">{station.suburb}</td>
									<td class="px-4 py-3">
										<span class="font-medium text-red-600">{station.fuel_types_dropped}</span>
									</td>
									<td class="px-4 py-3 text-gray-700">{formatDateTime(station.dropped_at)}</td>
									<td class="px-4 py-3">
										<span class="font-medium text-red-600">{Math.round(station.hours_since_drop)}h</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Dry Stations (individual fuel types) -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
			<div class="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<h2 class="text-lg font-semibold text-gray-900">
					Fuel Types Dropped
					{#if dryStations.length > 0}
						<span class="text-sm font-normal text-gray-500">({dryStations.length})</span>
					{/if}
				</h2>
				<select
					value={selectedFuelFilter}
					onchange={(e) => onFuelFilterChange(e.currentTarget.value)}
					class="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white"
				>
					<option value="">All fuel types</option>
					{#each FUEL_OPTIONS as fuel}
						<option value={fuel}>{FUEL_LABELS[fuel] ?? fuel}</option>
					{/each}
				</select>
			</div>

			{#if dryStations.length === 0}
				<div class="p-8 text-center text-gray-500">
					No fuel types have been dropped recently.
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="bg-gray-50 text-left">
								<th class="px-4 py-3 font-medium text-gray-500">Station</th>
								<th class="px-4 py-3 font-medium text-gray-500">Suburb</th>
								<th class="px-4 py-3 font-medium text-gray-500">Fuel Type</th>
								<th class="px-4 py-3 font-medium text-gray-500">Severity</th>
								<th class="px-4 py-3 font-medium text-gray-500">Dropped At</th>
								<th class="px-4 py-3 font-medium text-gray-500">Time Since</th>
								<th class="px-4 py-3 font-medium text-gray-500">Last Price</th>
							</tr>
						</thead>
						<tbody>
							{#each dryStations as station}
								<tr class="border-t border-gray-100 hover:bg-gray-50">
									<td class="px-4 py-3">
										<div class="font-medium text-gray-900">{station.station_name}</div>
										<div class="text-gray-500">{station.brand}</div>
									</td>
									<td class="px-4 py-3 text-gray-700">{station.suburb}</td>
									<td class="px-4 py-3">
										<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
											{station.fuel_type}
										</span>
									</td>
									<td class="px-4 py-3">
										<span class="px-2 py-0.5 rounded-full text-xs font-medium {severityClass(station.severity)}">
											{severityLabel(station.severity)}
										</span>
									</td>
									<td class="px-4 py-3 text-gray-700">{formatDateTime(station.dropped_at)}</td>
									<td class="px-4 py-3">
										{#if station.hours_since_drop >= 24}
											<span class="font-medium text-red-600">{(station.hours_since_drop / 24).toFixed(1)}d</span>
										{:else}
											<span class="font-medium text-orange-600">{Math.round(station.hours_since_drop)}h</span>
										{/if}
									</td>
									<td class="px-4 py-3">
										{#if station.previous_price}
											<span class="text-gray-500">{station.previous_price.toFixed(1)} c/L</span>
										{:else}
											<span class="text-gray-400">&mdash;</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>
