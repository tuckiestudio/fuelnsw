<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Chart } from 'chart.js';
  import { getRegionColor, getFuelColor, lightenColor } from '$lib/chart-colors';

  interface FuelTypeStats {
    fuel_type: string;
    avg_price: number;
    min_price: number;
    max_price: number;
    station_count: number;
    byRegion: Array<{ region: string; avg_price: number }>;
  }

  let { data, view, regions }: { 
    data: FuelTypeStats[]; 
    view: 'bar' | 'line';
    regions: string[];
  } = $props();
  
  let canvas: HTMLCanvasElement = null as any;
  let chart: Chart | null = null;
  let ChartJs: any = null;
  let chartLoaded = $state(false);

  async function ensureChartJs() {
    if (ChartJs) return;
    const chartjs = await import('chart.js');
    chartjs.Chart.register(...chartjs.registerables);
    ChartJs = chartjs.Chart;
    chartLoaded = true;
  }

  $effect(() => {
    if (!canvas || !data || data.length === 0 || !chartLoaded) return;
    
    if (chart) chart.destroy();

    const displayRegions = regions.length > 0 ? regions : ['All NSW'];
    
    const datasets = displayRegions.map((region, i) => {
      const color = getRegionColor(region);
      const regionData = data.map(d => {
        if (region === 'All NSW') {
          return d.avg_price;
        }
        const regionEntry = d.byRegion.find(r => r.region === region);
        return regionEntry?.avg_price || 0;
      });

      return {
        label: region,
        data: regionData,
        borderColor: color,
        backgroundColor: view === 'bar' ? lightenColor(color, 0.6) : color,
        borderWidth: 2,
        fill: view === 'line',
        tension: 0.3,
        pointRadius: view === 'line' ? 3 : 0,
        pointHoverRadius: 5
      };
    });

    chart = new ChartJs(canvas, {
      type: view,
      data: {
        labels: data.map(d => d.fuel_type),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'bottom',
            labels: { boxWidth: 12, padding: 10 }
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const fuelIndex = ctx.dataIndex;
                const fuelData = data[fuelIndex];
                const stationCount = fuelData?.station_count || 0;
                const val = ctx.parsed.y;
                return `${ctx.dataset.label}: ${val.toFixed(1)} c/L (${stationCount.toLocaleString()} stations)`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          },
          y: {
            beginAtZero: false,
            ticks: { 
              callback: (val: any) => `${val} c/L`,
              font: { size: 11 }
            },
            grid: { color: 'rgba(0,0,0,0.05)' }
          }
        }
      }
    });
  });

  onMount(async () => {
    await ensureChartJs();
  });

  onDestroy(() => {
    if (chart) chart.destroy();
  });
</script>

{#if !data || data.length === 0}
  <div class="flex items-center justify-center h-64 text-gray-400 text-sm">
    No data available for the selected filters
  </div>
{:else}
  <div class="h-64 lg:h-80">
    <canvas bind:this={canvas}></canvas>
  </div>
{/if}
