<script lang="ts">
	import { onDestroy } from 'svelte';

	let { stationCode, fuelType }: { stationCode: string; fuelType: string } = $props();

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let chart: any;
	let loading = $state(true);
	let error = $state('');
	let data: Array<{ price_updated: string; price: number }> = $state([]);

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
		try {
			const params = new URLSearchParams({ station: stationCode });
			const res = await fetch(`/api/fuel/history/batch?${params}`);
			if (!res.ok) throw new Error('Failed to load history');
			const allData: Record<string, Array<{ price_updated: string; price: number }>> = await res.json();
			data = allData[fuelType] || [];
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load chart';
		}
		loading = false;
	}

	async function renderChart() {
		if (data.length === 0) return;

		await ensureChartJs();
		const { Chart } = await import('chart.js');

		if (chart) chart.destroy();

		if (!canvas) return;

		const labels = data.map((d) => {
			const date = new Date(d.price_updated + 'T00:00:00');
			return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
		});
		const prices = data.map((d) => d.price);

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
						tension: 0.3,
						pointRadius: 2,
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
								return val != null ? `${val.toFixed(1)} c/L` : '';
							}
						}
					}
				},
				scales: {
					x: {
						ticks: { maxTicksLimit: 8, font: { size: 10 } },
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
	}

	$effect(() => {
		stationCode;
		fuelType;
		loadHistory();
	});

	$effect(() => {
		if (canvas && data.length > 0 && !loading) {
			renderChart();
		}
	});

	onDestroy(() => {
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
