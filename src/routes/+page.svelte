<script lang="ts">
	import { onMount } from 'svelte';
	import PriceChart from '$components/station/PriceChart.svelte';
	import { FUEL_OPTIONS, getPriceColor } from '$lib/utils/fuel-types';
	import type { StationGeoJSON } from '$lib/api/types';

	let mapContainer: HTMLDivElement;
	let map: any;
	let selectedFuelType: string = $state('E10');
	let selectedStation: StationGeoJSON | null = $state(null);
	let stations: StationGeoJSON[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let priceRange = $state({ min: 0, max: 0 });
	let markersLayer: any;
	let L: any;
	let currentZoom: number = $state(8);
	let searchQuery: string = $state('');
	let showSuggestions: boolean = $state(false);
	let postcodeBoundary: any = null;

	interface Location {
		postcode: string;
		suburb: string;
	}

	let locations = $derived.by(() => {
		const seen = new Set<string>();
		const result: Location[] = [];
		for (const s of stations) {
			const key = `${s.properties.postcode}-${s.properties.suburb}`;
			if (!seen.has(key) && s.properties.postcode) {
				seen.add(key);
				result.push({ postcode: s.properties.postcode, suburb: s.properties.suburb });
			}
		}
		return result.sort((a, b) => a.postcode.localeCompare(b.postcode));
	});

	let suggestions = $derived(
		searchQuery.trim().length >= 1
			? locations.filter(
					(loc) =>
						loc.postcode.startsWith(searchQuery.trim()) ||
						loc.suburb.toLowerCase().includes(searchQuery.trim().toLowerCase())
				).slice(0, 8)
			: []
	);

	let filteredStations = $derived(
		searchQuery.trim()
			? stations.filter((s) => {
					const q = searchQuery.trim();
					return (
						s.properties.postcode?.startsWith(q) ||
						s.properties.suburb?.toLowerCase().includes(q.toLowerCase())
					);
				})
			: stations
	);

	onMount(async () => {
		try {
			L = (await import('leaflet')).default;
			await loadStations();

			if (stations.length === 0) {
				const initRes = await fetch('/api/refresh', { method: 'POST' });
				const initData = await initRes.json();
				if (initData.status === 'error') {
					error = initData.message;
				}
				await loadStations();
			}

			await initMap();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load map data';
			loading = false;
		}
	});

	async function loadStations() {
		const res = await fetch('/api/fuel/stations');
		stations = await res.json();
		updatePriceRange();
	}

	function updatePriceRange() {
		const prices = filteredStations
			.map((s) => parseFloat(s.properties[selectedFuelType] ?? ''))
			.filter((p) => !isNaN(p));
		priceRange = {
			min: prices.length ? Math.min(...prices) : 0,
			max: prices.length ? Math.max(...prices) : 0
		};
	}

	async function initMap() {
		map = L.map(mapContainer, {
			center: [-33.8, 151.2],
			zoom: 8,
			zoomControl: true
		});

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; OpenStreetMap contributors',
			maxZoom: 18
		}).addTo(map);

		markersLayer = L.layerGroup().addTo(map);
		currentZoom = map.getZoom();
		renderMarkers();
		loading = false;

		map.on('zoomend', () => {
			const newZoom = map.getZoom();
			if (newZoom !== currentZoom) {
				currentZoom = newZoom;
				renderMarkers();
			}
		});
	}

	function renderMarkers() {
		if (!markersLayer || !L) return;
		markersLayer.clearLayers();

		const showLabels = currentZoom >= 12;

		for (const station of filteredStations) {
			const price = parseFloat(station.properties[selectedFuelType] ?? '');
			if (isNaN(price)) continue;

			const color = getPriceColor(price, priceRange.min, priceRange.max);
			const lat = station.geometry.coordinates[1];
			const lng = station.geometry.coordinates[0];

			let icon: any;
			if (showLabels) {
				const priceStr = price.toFixed(1);
				icon = L.divIcon({
					html: `<div style="
						background:${color};
						color:#fff;
						font-size:11px;
						font-weight:600;
						padding:2px 6px;
						border-radius:8px;
						white-space:nowrap;
						text-align:center;
						border:1px solid rgba(0,0,0,0.2);
						box-shadow:0 1px 3px rgba(0,0,0,0.3);
						line-height:1.4;
					">${priceStr}</div>`,
					iconSize: null,
					iconAnchor: [0, 0],
					className: ''
				});
			} else {
				icon = L.divIcon({
					html: `<div style="
						background:${color};
						width:12px;height:12px;
						border-radius:50%;
						border:1px solid #333;
					"></div>`,
					iconSize: [12, 12],
					iconAnchor: [6, 6],
					className: ''
				});
			}

			const marker = L.marker([lat, lng], { icon });

			const priceStr = price.toFixed(1);
			marker.bindTooltip(
				`<strong>${station.properties.name}</strong><br/>` +
					`${station.properties.brand}<br/>` +
					`${station.properties.suburb}<br/>` +
					`${selectedFuelType}: <strong>${priceStr}</strong> c/L`,
				{ direction: 'top', offset: [0, -8] }
			);

			marker.on('click', () => {
				selectedStation = station;
			});

			markersLayer.addLayer(marker);
		}
	}

	async function onFuelTypeChange(fuelType: string) {
		selectedFuelType = fuelType;
		updatePriceRange();
		renderMarkers();
	}

	function closePanel() {
		selectedStation = null;
	}

	function clearPostcodeBoundary() {
		if (postcodeBoundary) {
			postcodeBoundary.remove();
			postcodeBoundary = null;
		}
	}

	async function fetchPostcodeBoundary(postcode: string) {
		if (!L || !map) return;
		clearPostcodeBoundary();

		try {
			const res = await fetch(`/api/postcode-boundary?postcode=${postcode}`);
			if (!res.ok) {
				console.warn('Boundary fetch failed:', res.status);
				return;
			}
			const data = await res.json();
			const outlines: [number, number][][] = data.outlines || [];

			if (outlines.length === 0) return;

			postcodeBoundary = L.layerGroup();
			for (const coords of outlines) {
				L.polygon(coords, {
					color: '#ef4444',
					weight: 3,
					opacity: 1,
					fillColor: '#ef4444',
					fillOpacity: 0.1
				}).addTo(postcodeBoundary);
			}
			postcodeBoundary.addTo(map);
		} catch (e) {
			console.warn('Failed to fetch postcode boundary:', e);
		}
	}

	function flyToResults() {
		if (!map) return;
		const q = searchQuery.trim();
		if (q) {
			const matching = stations.filter(
				(s) =>
					s.properties.postcode?.startsWith(q) ||
					s.properties.suburb?.toLowerCase().includes(q.toLowerCase())
			);
			const validCoords = matching
				.map((s) => [s.geometry.coordinates[1], s.geometry.coordinates[0]] as [number, number])
				.filter(([lat, lng]) => Math.abs(lat) > 1 && Math.abs(lng) > 1);
			if (validCoords.length === 0) return;
			const bounds = L.latLngBounds(validCoords);
			map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15 });
		} else {
			map.flyTo([-33.8, 151.2], 8, { duration: 0.8 });
		}
	}

	let searchDebounce: ReturnType<typeof setTimeout>;
	function onSearchInput() {
		showSuggestions = true;
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			updatePriceRange();
			renderMarkers();
		}, 300);
	}

	function selectSuggestion(postcode: string) {
		searchQuery = postcode;
		showSuggestions = false;
		updatePriceRange();
		renderMarkers();
		flyToResults();
		if (/^\d{4}$/.test(postcode)) {
			fetchPostcodeBoundary(postcode);
		}
	}

	function clearSearch() {
		searchQuery = '';
		showSuggestions = false;
		clearPostcodeBoundary();
		updatePriceRange();
		renderMarkers();
		map?.flyTo([-33.8, 151.2], 8, { duration: 0.8 });
	}
</script>

<div class="relative flex h-[calc(100vh-3.5rem)]">
	<!-- Controls row -->
	<div class="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-start gap-2">
		<!-- Search bar -->
		<div class="flex flex-col gap-1 shrink-0">
			<div class="flex items-center gap-2 bg-white rounded-lg shadow-lg px-3 py-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
				<input
					type="text"
					placeholder="Postcode or suburb..."
					bind:value={searchQuery}
					oninput={onSearchInput}
					onfocus={() => (showSuggestions = true)}
					onblur={() => setTimeout(() => (showSuggestions = false), 200)}
					class="w-36 text-sm outline-none bg-transparent placeholder-gray-400"
				/>
				{#if searchQuery}
					<button onclick={clearSearch} class="text-gray-400 hover:text-gray-600 shrink-0">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
					</button>
				{/if}
			</div>
			{#if showSuggestions && suggestions.length > 0}
				<div class="bg-white rounded-lg shadow-lg max-h-60 overflow-y-auto">
					{#each suggestions as loc}
						<button
							onclick={() => selectSuggestion(loc.postcode)}
							class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 last:border-0"
						>
							<span class="font-mono font-medium text-gray-700">{loc.postcode}</span>
							<span class="text-gray-500 truncate">{loc.suburb}</span>
						</button>
					{/each}
				</div>
			{/if}
			{#if searchQuery.trim() && !showSuggestions}
				<div class="bg-white rounded-lg shadow-lg px-3 py-1.5 text-xs text-gray-600">
					{filteredStations.length} station{filteredStations.length !== 1 ? 's' : ''} found
				</div>
			{/if}
		</div>

		<!-- Fuel type filter bar -->
		<div class="flex gap-1 bg-white rounded-lg shadow-lg px-2 py-1.5 overflow-x-auto">
		{#each FUEL_OPTIONS as fuel}
			<button
				onclick={() => onFuelTypeChange(fuel)}
				class="px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap {selectedFuelType === fuel
					? 'bg-green-600 text-white'
					: 'text-gray-600 hover:bg-gray-100'}"
			>
				{fuel}
			</button>
		{/each}
		</div>
	</div>

	<!-- Price legend -->
	{#if priceRange.min !== priceRange.max}
		<div class="absolute bottom-6 left-3 z-[1000] bg-white rounded-lg shadow-lg p-3 text-xs">
			<div class="font-medium mb-1.5 text-gray-700">{selectedFuelType} Prices</div>
			<div class="flex items-center gap-1.5">
				<span class="text-green-600 font-medium">{priceRange.min.toFixed(1)}</span>
				<div class="w-20 h-2 rounded bg-gradient-to-r from-green-500 via-yellow-500 via-orange-400 to-red-500"></div>
				<span class="text-red-600 font-medium">{priceRange.max.toFixed(1)}</span>
			</div>
			<div class="text-gray-400 mt-1">Zoom in to see prices on map</div>
		</div>
	{/if}

	<!-- Map -->
	<div bind:this={mapContainer} class="flex-1"></div>

	<!-- Loading overlay -->
	{#if loading}
		<div class="absolute inset-0 flex items-center justify-center bg-white/80 z-[1001]">
			<div class="flex items-center gap-2 text-gray-600">
				<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
				Loading fuel prices...
			</div>
		</div>
	{/if}

	<!-- Error -->
	{#if error}
		<div class="absolute top-16 left-1/2 -translate-x-1/2 z-[1001] bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm max-w-md text-center">
			{error}
			<button onclick={() => (error = '')} class="ml-2 font-bold">&times;</button>
		</div>
	{/if}

	<!-- Backdrop (mobile only) -->
	{#if selectedStation}
		<div
			class="sm:hidden absolute inset-0 bg-black/30 z-[999]"
			role="button"
			aria-label="Close panel"
			tabindex="0"
			onclick={closePanel}
			onkeydown={(e) => e.key === 'Escape' && closePanel()}
		></div>
	{/if}

	<!-- Station detail panel -->
	{#if selectedStation}
		{@const station = selectedStation}
		<div class="absolute right-0 bg-white shadow-xl z-[1000] flex flex-col border-t sm:border-t-0 sm:border-l border-gray-200
			bottom-0 left-0 max-h-[70vh] rounded-t-xl sm:max-h-none sm:rounded-none sm:w-96 sm:top-0 sm:h-full">
			<!-- Header -->
			<div class="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 shrink-0">
				<h2 class="font-bold text-base sm:text-lg text-gray-900 truncate pr-2">{station.properties.name}</h2>
				<button onclick={closePanel} aria-label="Close panel" class="p-1 rounded-md hover:bg-gray-100 text-gray-500 shrink-0">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
			<!-- Drag handle (mobile) -->
			<div class="sm:hidden flex justify-center pt-1 pb-0 shrink-0">
				<div class="w-10 h-1 bg-gray-300 rounded-full"></div>
			</div>
			<div class="p-3 sm:p-4 overflow-y-auto flex-1">
				<div class="space-y-4">
					<!-- Station info -->
					<div class="grid grid-cols-2 gap-3 text-sm">
						<div>
							<div class="text-gray-500 text-xs">Brand</div>
							<div class="font-medium">{station.properties.brand || 'Unknown'}</div>
						</div>
						<div>
							<div class="text-gray-500 text-xs">Suburb</div>
							<div class="font-medium">{station.properties.suburb}</div>
						</div>
						<div class="col-span-2">
							<div class="text-gray-500 text-xs">Address</div>
							<div class="font-medium">{station.properties.address}</div>
						</div>
					</div>

					<hr class="border-gray-200">

					<!-- Current prices -->
					<div>
						<div class="text-sm font-medium text-gray-700 mb-2">Current Prices</div>
						<div class="space-y-1">
							{#each FUEL_OPTIONS as fuel}
								{@const price = station.properties[fuel]}
								{#if price}
									<div class="flex justify-between items-center py-1.5 px-2.5 bg-gray-50 rounded-md">
										<span class="text-sm">{fuel}</span>
										<span class="font-bold text-sm">{parseFloat(price).toFixed(1)} c/L</span>
									</div>
								{/if}
							{/each}
						</div>
					</div>

					<hr class="border-gray-200">

					<!-- Historical price charts — one per fuel type -->
					<div>
						<div class="text-sm font-medium text-gray-700 mb-2">Price History</div>
						<div class="space-y-3">
							{#each FUEL_OPTIONS as fuel}
								{@const price = station.properties[fuel]}
								{#if price}
									<div>
										<div class="text-xs font-medium text-gray-500 mb-1">{fuel}</div>
										<PriceChart stationCode={station.properties.code} fuelType={fuel} />
									</div>
								{/if}
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
