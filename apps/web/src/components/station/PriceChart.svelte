<script lang="ts">
	import { onDestroy } from 'svelte';

	let { stationCode, fuelType }: { stationCode: string; fuelType: string } = $props();

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let chart: any;
	let loading = $state(true);
	let error = $state('');
	let data: Array<{ price_updated: string; price: number }> = $state([]);
	let isDestroyed = false;

	let chartJsLoaded = false;

	async function ensureChartJs() {
		if (chartJsLoaded) return;
		const { Chart, registerables } = await import('chart.js');
		Chart.register(...registerables);
		chartJsLoaded = true;
	}

	async function loadHistory() {
		if (!stationCode || !fuelType) return;

		loading = true;
		error = '';

		for (let attempt = 0; attempt < 3; attempt++) {
			if (isDestroyed) return;
			try {
				const params = new URLSearchParams({ station: stationCode, fuel: fuelType });
				const res = await fetch(`/api/fuel/history?${params}`);
				if (!res.ok) {
					const errText = await res.text();
					throw new Error(`Failed to load history: ${res.status} ${errText}`);
				}
				const result: Array<{ price_updated: string; price: number }> = await res.json();
				if (isDestroyed) return;
				data = (result || []).filter(d =>
					d &&
					d.price_updated &&
					typeof d.price_updated === 'string' &&
					typeof d.price === 'number'
				);
				loading = false;
				return;
			} catch (e: any) {
				const msg = e?.message || String(e);
				if (msg.includes('Load failed') || msg.includes('did not match') || msg.includes('AbortError') || msg.includes('NetworkError')) {
					if (attempt < 2) {
						await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
						continue;
					}
				}
				if (!isDestroyed) {
					error = msg;
				}
				loading = false;
				return;
			}
		}
		loading = false;
	}

	async function renderChart() {
		if (data.length === 0) return;

		try {
			await ensureChartJs();
			const { Chart } = await import('chart.js');

			if (chart) chart.destroy();

			if (!canvas) return;

			const validData = data.filter((d) => 
				d && 
				d.price_updated && 
				typeof d.price_updated === 'string' && 
				typeof d.price === 'number'
			).sort((a, b) => a.price_updated.localeCompare(b.price_updated));

			if (validData.length === 0) {
				return;
			}

			const prices = validData.map((d) => d.price);
			const dates = validData.map((d) => {
				const dateMatch = d.price_updated.match(/^(\d{4})-(\d{2})-(\d{2})/);
				if (dateMatch) {
					return new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
				}
				return new Date();
			});
			
			const labels = dates.map((d, i) => {
				const isLast = i === dates.length - 1;
				if (isLast) {
					return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
				}
				return d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
			});

			chart = new Chart(canvas, {
				type: 'line',
				data: {
					labels,
					datasets: [
						{
							label: `${fuelType} (c/L)`,
							data: prices,
							borderColor: '#22c55e',
							backgroundColor: 'rgba(34, 197, 94, 0.1)',
							fill: true,
							tension: 0.4,
							pointRadius: 0,
							pointHoverRadius: 5,
							borderWidth: 2
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								label: (ctx) => {
									const val = ctx.parsed.y;
									const index = ctx.dataIndex;
									const date = dates[index];
									const dateStr = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
									return `${dateStr}: ${val.toFixed(1)} c/L`;
								}
							}
						}
					},
					scales: {
						x: {
							ticks: {
								font: { size: 10 },
								maxRotation: 90,
								minRotation: 90,
								autoSkip: false,
								align: 'center'
							},
							grid: { display: false }
						},
						y: {
							ticks: {
								callback: (val) => `${val} c/L`,
								font: { size: 10 }
							},
							grid: { color: 'rgba(0,0,0,0.05)' }
						}
					}
				}
			});
		} catch (err) {
			console.error('PriceChart renderChart error:', err);
			error = 'Failed to render chart';
		}
	}

	$effect(() => {
		if (stationCode && fuelType) {
			loadHistory();
		}
	});

	$effect(() => {
		if (canvas && data.length > 0 && !loading && !error) {
			renderChart();
		}
	});

	onDestroy(() => {
		isDestroyed = true;
		if (chart) chart.destroy();
	});
</script>

{#if loading}
	<div class="flex items-center justify-center h-48 text-sm text-gray-400">
		Loading chart...
	</div>
{:else if error}
	<div class="text-sm text-red-500">{error}</div>
{:else if data.length === 0}
	<div class="text-sm text-gray-400 py-8 text-center">
		No historical data available for this fuel type.
	</div>
{:else}
	<div class="h-48">
		<canvas bind:this={canvas}></canvas>
	</div>
{/if}
