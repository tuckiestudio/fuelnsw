<script lang="ts">
  import { onMount } from 'svelte';

  let { selectedRegions, onRegionClick }: { 
    selectedRegions: string[];
    onRegionClick: (region: string) => void;
  } = $props();
  
  let mapContainer: HTMLDivElement = null as any;
  let map: any = null;
  let L: any = null;

  // Simplified NSW region centroids for map markers
  const REGION_CENTROIDS: Record<string, [number, number]> = {
    'Sydney': [-33.8688, 151.2093],
    'Central Coast': [-33.3000, 151.2000],
    'Newcastle and Lake Macquarie': [-32.9267, 151.7789],
    'Illawarra': [-34.4278, 150.8931],
    'Richmond - Tweed': [-28.8500, 153.3000],
    'Southern Highlands and Shoalhaven': [-34.6000, 150.2000],
    'Hunter Valley (excludes Newcastle)': [-32.5000, 151.0000],
    'Mid North Coast': [-31.5000, 152.5000],
    'Coffs Harbour - Grafton': [-30.3000, 153.1000],
    'Capital Region': [-35.2809, 149.1300],
    'Central West': [-33.4000, 149.5000],
    'Riverina': [-35.1000, 147.4000],
    'New England and North West': [-30.5000, 151.5000],
    'Murray': [-36.0000, 146.5000],
    'Far West and Orana': [-31.5000, 145.0000]
  };

  async function initMap() {
    L = (await import('leaflet')).default;

    const leafletCss = document.createElement('link');
    leafletCss.rel = 'stylesheet';
    leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(leafletCss);

    map = L.map(mapContainer, {
      center: [-33.5, 147.0],
      zoom: 6,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '',
      maxZoom: 8
    }).addTo(map);

    // Add region markers
    for (const [region, coords] of Object.entries(REGION_CENTROIDS)) {
      const isSelected = selectedRegions.includes(region);
      
      const marker = L.circleMarker(coords, {
        radius: 8,
        fillColor: isSelected ? '#22c55e' : '#9ca3af',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: isSelected ? 0.8 : 0.5
      });

      marker.bindTooltip(region, {
        direction: 'top',
        offset: [0, -10]
      });

      marker.on('click', () => {
        onRegionClick(region);
      });

      marker.addTo(map);
    }
  }

  $effect(() => {
    if (!map) return;
    
    // Update marker colors based on selection
    map.eachLayer((layer: any) => {
      if (layer instanceof L.CircleMarker) {
        const tooltip = layer.getTooltip();
        if (tooltip) {
          const region = tooltip.getContent();
          const isSelected = selectedRegions.includes(region as string);
          layer.setStyle({
            fillColor: isSelected ? '#22c55e' : '#9ca3af',
            fillOpacity: isSelected ? 0.8 : 0.5
          });
        }
      }
    });
  });

  onMount(async () => {
    await initMap();
  });
</script>

<div class="bg-white rounded-lg shadow p-4 border border-gray-200">
  <h3 class="font-semibold text-sm text-gray-700 mb-3">NSW Regions</h3>
  <div bind:this={mapContainer} class="h-48 lg:h-64 rounded-lg"></div>
  <p class="text-xs text-gray-500 mt-2">Click regions to select/deselect</p>
</div>
