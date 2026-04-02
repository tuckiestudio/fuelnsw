<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Chart } from 'chart.js';
  import { getRegionColor, getBrandColor, lightenColor } from '$lib/chart-colors';

  interface BrandStats {
    brand: string;
    is_group: boolean;
    sub_brands?: Array<{ name: string; count: number }>;
    avg_price: number;
    min_price: number;
    max_price: number;
    station_count: number;
    byRegion: Array<{ region: string; avg_price: number }>;
  }

  let { data, view, regions }: { 
    data: BrandStats[]; 
    view: 'bar' | 'line';
    regions: string[];
  } = $props();
  
  let canvas = $state<HTMLCanvasElement>(null as any);
  let chart: Chart | null = null;
  let ChartJs: any = null;
  let chartLoaded = $state(false);

  let limitedData = $derived(data.slice(0, 15));

  async function ensureChartJs() {
    if (ChartJs) return;
    const chartjs = await import('chart.js');
    chartjs.Chart.register(...chartjs.registerables);
    ChartJs = chartjs.Chart;
    chartLoaded = true;
  }

  $effect(() => {
    if (!canvas || !limitedData || limitedData.length === 0 || !chartLoaded) return;
    
    if (chart) chart.destroy();

    const displayRegions = regions.length > 0 ? regions : ['All NSW'];
    
    const datasets = displayRegions.map((region, i) => {
      const color = getRegionColor(region);
      const regionData = limitedData.map(d => {
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
        labels: limitedData.map(d => d.brand),
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
                const brandIndex = ctx.dataIndex;
                const brandData = limitedData[brandIndex];
                const stationCount = brandData?.station_count || 0;
                const val = ctx.parsed.y;
                let label = `${ctx.dataset.label}: ${val.toFixed(1)} c/L (${stationCount.toLocaleString()} stations)`;
                if (brandData?.is_group && brandData.sub_brands) {
                  label += `\n${brandData.sub_brands.map(sb => `  ${sb.name}`).join('\n')}`;
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { 
              font: { size: 10 },
              maxRotation: 45,
              minRotation: 45
            }
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

{#if !limitedData || limitedData.length === 0}
  <div class="flex items-center justify-center h-64 text-gray-400 text-sm">
    No data available for the selected filters
  </div>
{:else}
  <div class="h-64 lg:h-80">
    <canvas bind:this={canvas}></canvas>
  </div>
{/if}
