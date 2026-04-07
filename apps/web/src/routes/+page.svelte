<script lang="ts">
	import { onMount } from 'svelte';
	import { getPriceColor, FUEL_COLORS } from '@fuelnsw/shared/utils/fuel-types';
	import { calculateDiscount } from '@fuelnsw/shared/utils/discounts';
	import type { StationGeoJSON } from '@fuelnsw/shared/api/types';
	import { Capacitor } from '@capacitor/core';
	import SearchBar from '$components/map/SearchBar.svelte';
	import FuelTypeSelector from '$components/map/FuelTypeSelector.svelte';
	import StationPanel from '$components/map/StationPanel.svelte';
	import Legend from '$components/map/Legend.svelte';
	import Onboarding from '$components/map/Onboarding.svelte';
	import LocateButton from '$components/map/LocateButton.svelte';
	import QuickFuelButton from '$components/map/QuickFuelButton.svelte';
	import QuickFuelSheet from '$components/map/QuickFuelSheet.svelte';
	import StationListPanel from '$components/map/StationListPanel.svelte';
	import {
		getFuelType,
		setFuelType as saveFuelType,
		getOnboarded,
		setOnboarded,
		getLastPosition,
		setLastPosition,
		getOpenOnly,
		setOpenOnly
	} from '$lib/preferences';
	import { selectedDiscounts } from '$lib/discount-state.svelte';


	let mapContainer: HTMLDivElement;
	let map: any;
	let selectedFuelType: string = $state(getFuelType());
	let showOnboarding = $state(!getOnboarded());
	let selectedStation: StationGeoJSON | null = $state(null);
	let selectedStationFullData: StationGeoJSON | null = $state(null);
	let stations: StationGeoJSON[] = $state([]);
	let loading = $state(true);
	let error = $state('');
	let priceRange = $state({ min: 0, max: 0 });
	let clusterLayer: any;
	let L: any;
	let markerMap = new Map<string, any>();
	let stationMap = new Map<string, StationGeoJSON>();
	let hoveredStationCode: string | null = $state(null);
	let hoverTooltip: any = null;
	let searchQuery: string = $state('');
	let showSuggestions: boolean = $state(false);
	let postcodeBoundary: any = null;
	let allLocations: { postcode: string; suburb: string; lat: number; lng: number }[] = [];
	let userMarker: any = null;
	let userPosition: { lat: number; lng: number } | null = $state(null);
	let searchedLocation: { lat: number; lng: number } | null = $state(null);
	let showQuickFuel = $state(false);
	let quickFuelLoading = $state(false);
	let quickFuelStations: any[] = $state([]);
	let isMobile = $state(true);
	let openOnly = $state(getOpenOnly());
	let showStationList = $state(false);

	function escapeHtml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	let suggestions = $derived(
		searchQuery.trim().length >= 1
			? allLocations
					.filter(
						(loc) =>
							loc.postcode.startsWith(searchQuery.trim()) ||
							loc.suburb.toLowerCase().includes(searchQuery.trim().toLowerCase())
					)
					.slice(0, 8)
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

	let resolvedStation = $derived(selectedStationFullData || selectedStation);
	let hideMobileControls = $derived((!!resolvedStation || showQuickFuel || showStationList) && isMobile);

	function showStationHover(code: string) {
		if (!map || !L) return;
		hideStationHover();
		const station = stationMap.get(code);
		if (!station) return;
		const knownFuels = ['E10', 'Unleaded', 'P95', 'P98', 'Diesel', 'PDL', 'LPG', 'E85', 'B20'];
		const stationFuels = knownFuels.filter(f => station.properties[f] != null);

		const fuelRows = stationFuels
			.map(f => {
				const val = parseFloat(String(station.properties[f]));
				if (isNaN(val)) return '';
				const color = FUEL_COLORS[f] ?? '#94a3b8';
                const isHighlighted = f === selectedFuelType;
                const rowClass = isHighlighted ? 'fuel-row highlighted' : 'fuel-row';
                const weight = isHighlighted ? 'font-weight:700' : 'font-weight:400';
                if (isHighlighted && selectedDiscounts.length > 0) {
                    const discount = calculateDiscount(station.properties.brand, f, selectedDiscounts);
                    if (discount.totalDiscount > 0) {
                        const discVal = val - discount.totalDiscount;
                        return `<div class="${rowClass}"><span class="fuel-dot" style="background:${color}"></span><span class="fuel-name">${escapeHtml(f)}</span><span class="fuel-price" style="${weight}"><span style="text-decoration:line-through;color:#94a3b8;font-weight:400;font-size:10px">${val.toFixed(1)}</span> ${discVal.toFixed(1)}</span></div>`;
                    }
                }
                return `<div class="${rowClass}"><span class="fuel-dot" style="background:${color}"></span><span class="fuel-name">${escapeHtml(f)}</span><span class="fuel-price" style="${weight}">${val.toFixed(1)}</span></div>`;
            })
			.filter(Boolean)
			.join('');
		const html = `<div class="station-tooltip">` +
			`<div class="tooltip-name">${escapeHtml(station.properties.name)}</div>` +
			`<div class="tooltip-fuels">${fuelRows}</div>` +
		`</div>`;
		hoverTooltip = L.tooltip({ permanent: true, direction: 'top', offset: [0, -8], className: 'station-tooltip-container' })
			.setLatLng([station.geometry.coordinates[1], station.geometry.coordinates[0]])
			.setContent(html)
			.addTo(map);
		const marker = markerMap.get(code);
		if (marker) {
			const el = marker.getElement();
			if (el) el.querySelector('.price-label')?.classList.add('price-label-hover');
		}
	}

	function hideStationHover() {
		if (!map || !L) return;
		markerMap.forEach((marker) => {
			const el = marker.getElement();
			if (el) el.querySelector('.price-label')?.classList.remove('price-label-hover');
		});
		if (hoverTooltip) {
			hoverTooltip.remove();
			hoverTooltip = null;
		}
	}

	async function loadLocations() {
		try {
			const res = await fetch(`/api/fuel/stations?open_only=false`);
			const all: StationGeoJSON[] = await res.json();
			const seen = new Set<string>();
			allLocations = [];
			for (const s of all) {
				const key = `${s.properties.postcode}-${s.properties.suburb}`;
				if (!seen.has(key) && s.properties.postcode) {
					seen.add(key);
					const lat = s.geometry.coordinates[1];
					const lng = s.geometry.coordinates[0];
					if (Math.abs(lat) > 1 && Math.abs(lng) > 1) {
						allLocations.push({
							postcode: s.properties.postcode,
							suburb: s.properties.suburb,
							lat,
							lng
						});
					}
				}
			}
			allLocations.sort((a, b) => a.postcode.localeCompare(b.postcode));
		} catch {}
	}

	async function loadViewportStations() {
		if (!map) return;
		const bounds = map.getBounds();
		const zoom = map.getZoom();

		if (zoom < 8) {
			stations = [];
			updatePriceRange();
			renderMarkers();
			return;
		}

		try {
			const params = new URLSearchParams({
				south: bounds.getSouth().toFixed(4),
				west: bounds.getWest().toFixed(4),
				north: bounds.getNorth().toFixed(4),
				east: bounds.getEast().toFixed(4),
				fuel: selectedFuelType,
				open_only: String(openOnly)
			});
			const res = await fetch(`/api/fuel/stations/viewport?${params}`);
			if (res.ok) {
				stations = await res.json();
				if (stations.length === 0 && loading) {
					error = 'No fuel data available. Trigger a data refresh via the admin API.';
				}
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load stations';
		}
		updatePriceRange();
		renderMarkers();
	}

	function updatePriceRange() {
		const source = searchQuery.trim() ? filteredStations : stations;
		const prices = source
			.map((s) => {
				const raw = parseFloat(String(s.properties[selectedFuelType] ?? ''));
				if (isNaN(raw)) return NaN;
				if (selectedDiscounts.length === 0) return raw;
				const d = calculateDiscount(s.properties.brand, selectedFuelType, selectedDiscounts);
				return raw - d.totalDiscount;
			})
			.filter((p) => !isNaN(p));
		priceRange = {
			min: prices.length ? Math.min(...prices) : 0,
			max: prices.length ? Math.max(...prices) : 0
		};
	}

	async function initMap() {
		await import('leaflet/dist/leaflet.css');
		L = (await import('leaflet')).default;
		await import('leaflet.markercluster');

		const savedPos = getLastPosition();
		const center = savedPos ? [savedPos.lat, savedPos.lng] : [-33.8, 151.2];
		const zoom = savedPos ? 14 : 10;

		map = L.map(mapContainer, { center, zoom, zoomControl: false });

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; OpenStreetMap contributors',
			maxZoom: 18
		}).addTo(map);

		L.control.zoom({ position: 'bottomright' }).addTo(map);

		clusterLayer = L.markerClusterGroup({
			maxClusterRadius: 50,
			spiderfyOnMaxZoom: true,
			showCoverageOnHover: false,
			zoomToBoundsOnClick: true,
			iconCreateFunction: (cluster: any) => {
				const count = cluster.getChildCount();
				const markers = cluster.getAllChildMarkers();
				const prices = markers.map((m: any) => m.price).filter((p: any) => p !== undefined);
				const avgPrice = prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0;
				const color = getPriceColor(avgPrice, priceRange.min, priceRange.max);
				const cr = parseInt(color.slice(1, 3), 16);
				const cg = parseInt(color.slice(3, 5), 16);
				const cb = parseInt(color.slice(5, 7), 16);

				let dim = 40;
				let innerDim = 32;
				let margin = 4;
				let fontSize = 12;
				if (count > 100) {
					dim = 56;
					innerDim = 44;
					margin = 6;
					fontSize = 13;
				} else if (count > 30) {
					dim = 48;
					innerDim = 38;
					margin = 5;
				}

				return L.divIcon({
					html: `<div style="background-color:rgba(${cr},${cg},${cb},0.3);border-radius:50%"><div style="background-color:rgba(${cr},${cg},${cb},0.7);width:${innerDim}px;height:${innerDim}px;margin:${margin}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:${fontSize}px"><span>${count}</span></div></div>`,
					className: 'marker-cluster',
					iconSize: L.point(dim, dim)
				});
			}
		});

		map.addLayer(clusterLayer);

		await loadViewportStations();
		loading = false;

		let moveTimeout: ReturnType<typeof setTimeout>;
		map.on('moveend zoomend', () => {
			clearTimeout(moveTimeout);
			moveTimeout = setTimeout(loadViewportStations, 200);
		});
	}

	function renderMarkers() {
		if (!clusterLayer || !L) return;
		clusterLayer.clearLayers();
		markerMap.clear();
		stationMap.clear();

		const source = searchQuery.trim() ? filteredStations : stations;

		for (const station of source) {
			const rawPrice = station.properties[selectedFuelType];
			const price = parseFloat(String(rawPrice ?? ''));
			if (isNaN(price)) continue;

			const discount = selectedDiscounts.length > 0
				? calculateDiscount(station.properties.brand, selectedFuelType, selectedDiscounts)
				: { totalDiscount: 0, appliedDiscounts: [] as { id: string; amount: number; name: string }[] };
			const discountedPrice = price - discount.totalDiscount;
			const displayPrice = discount.totalDiscount > 0 ? discountedPrice : price;
			const color = getPriceColor(displayPrice, priceRange.min, priceRange.max);
			const lat = station.geometry.coordinates[1];
			const lng = station.geometry.coordinates[0];

			let markerHtml: string;
			if (discount.totalDiscount > 0) {
				markerHtml = `<div class="price-label price-label-discounted" style="background:${color}"><span>${escapeHtml(discountedPrice.toFixed(1))}</span><span class="discount-badge">-${discount.totalDiscount}</span></div>`;
			} else {
				markerHtml = `<div class="price-label" style="background:${color}"><span>${escapeHtml(price.toFixed(1))}</span></div>`;
			}

			const icon = L.divIcon({
				html: markerHtml,
				iconSize: null,
				iconAnchor: [0, 0],
				className: ''
			});

			const marker = L.marker([lat, lng], { icon });
			(marker as any).price = price;

			const knownFuels = ['E10', 'Unleaded', 'P95', 'P98', 'Diesel', 'PDL', 'LPG', 'E85', 'B20'];
			const stationFuels = knownFuels.filter(f => station.properties[f] != null);
			let fuelRows = stationFuels
				.map(f => {
					const val = parseFloat(String(station.properties[f]));
					if (isNaN(val)) return '';
					const color = FUEL_COLORS[f] ?? '#94a3b8';
					const isHighlighted = f === selectedFuelType;
					const rowClass = isHighlighted ? 'fuel-row highlighted' : 'fuel-row';
					const weight = isHighlighted ? 'font-weight:700' : 'font-weight:400';
					return `<div class="${rowClass}"><span class="fuel-dot" style="background:${color}"></span><span class="fuel-name">${escapeHtml(f)}</span><span class="fuel-price" style="${weight}">${val.toFixed(1)}</span></div>`;
				})
				.filter(Boolean)
				.join('');

			marker.bindTooltip(
				`<div class="station-tooltip">` +
					`<div class="tooltip-name">${escapeHtml(station.properties.name)}</div>` +
					`<div class="tooltip-fuels">${fuelRows}</div>` +
				`</div>`,
				{ direction: 'top', offset: [0, -8], className: 'station-tooltip-container' }
			);

			marker.on('mouseover', () => {
				hoveredStationCode = station.properties.code;
				const el = marker.getElement();
				if (el) el.querySelector('.price-label')?.classList.add('price-label-hover');
			});
			marker.on('mouseout', () => {
				hoveredStationCode = null;
				const el = marker.getElement();
				if (el) el.querySelector('.price-label')?.classList.remove('price-label-hover');
			});

			marker.on('click', () => {
				selectStation(station);
			});

			clusterLayer.addLayer(marker);
			markerMap.set(station.properties.code, marker);
			stationMap.set(station.properties.code, station);
		}
	}

	function completeOnboarding(fuelType: string) {
		selectedFuelType = fuelType;
		saveFuelType(fuelType);
		setOnboarded();
		showOnboarding = false;
	}

	async function onFuelTypeChange(fuelType: string) {
		selectedFuelType = fuelType;
		saveFuelType(fuelType);
		selectedStationFullData = null;
		await loadViewportStations();
	}

	function onOpenOnlyChange(value: boolean) {
		openOnly = value;
		setOpenOnly(value);
		loadViewportStations();
	}

	function closePanel() {
		selectedStation = null;
		selectedStationFullData = null;
	}

	function closeAllPanels() {
		showQuickFuel = false;
		showStationList = false;
		closePanel();
	}

	async function selectStation(station: StationGeoJSON) {
		showQuickFuel = false;
		showStationList = false;
		selectedStation = station;
		selectedStationFullData = null;
		try {
			const res = await fetch(`/api/fuel/station/${station.properties.code}`);
			if (res.ok) {
				const data = await res.json();
				if (data && data.prices) {
					selectedStationFullData = {
						...station,
						properties: {
							...station.properties,
							opening_hours: data.station?.opening_hours ?? station.properties.opening_hours,
							is_open: data.is_open ?? station.properties.is_open,
							...data.prices.reduce(
								(acc: Record<string, string>, p: { fuel_type: string; price: number }) => {
									acc[p.fuel_type] = String(p.price);
									return acc;
								},
								{}
							)
						}
					};
				} else {
					selectedStationFullData = station;
				}
			} else {
				selectedStationFullData = station;
			}
		} catch (err) {
			console.error('Failed to fetch full station data:', err);
			selectedStationFullData = station;
		}
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
			if (!res.ok) return;
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
		} catch {}
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
			map.flyTo([-33.8, 151.2], 10, { duration: 0.8 });
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
		showSuggestions = false;

		const loc = allLocations.find(
			(l) => l.postcode === postcode || l.suburb.toLowerCase() === postcode.toLowerCase()
		);

		if (loc && map) {
			map.flyTo([loc.lat, loc.lng], 14, { duration: 0.8 });
			searchedLocation = { lat: loc.lat, lng: loc.lng };
		}

		if (/^\d{4}$/.test(postcode)) {
			fetchPostcodeBoundary(postcode);
		}

		searchQuery = '';
	}

	function clearSearch() {
		searchQuery = '';
		showSuggestions = false;
		searchedLocation = null;
		clearPostcodeBoundary();
		updatePriceRange();
		renderMarkers();
		map?.flyTo([-33.8, 151.2], 10, { duration: 0.8 });
	}

	async function openQuickFuel() {
		closePanel();
		const position = searchedLocation || userPosition;
		if (position) {
			await fetchQuickFuel(position);
			return;
		}
		quickFuelLoading = true;
		locateMe(() => {
			if (userPosition) {
				fetchQuickFuel(userPosition);
			} else {
				quickFuelLoading = false;
				error = 'Could not determine your location';
			}
		});
	}

	async function fetchQuickFuel(position: { lat: number; lng: number }) {
		quickFuelLoading = true;
		showQuickFuel = false;
		const radii = [5, 10, 15, 20];
		try {
			for (const radius of radii) {
				const params = new URLSearchParams({
					lat: String(position.lat),
					lng: String(position.lng),
					fuel: selectedFuelType,
					limit: '10',
					radius: String(radius),
					open_only: String(openOnly)
				});
				const res = await fetch(`/api/fuel/stations/nearest?${params}`);
				if (res.ok) {
					const data = await res.json();
					quickFuelStations = data.stations || [];
					if (quickFuelStations.length > 0) {
						showQuickFuel = true;
						break;
					}
				} else {
					error = 'Failed to find nearby stations';
					break;
				}
			}
			if (!showQuickFuel && !error) {
				error = `No ${selectedFuelType} stations found nearby`;
			}
		} catch {
			error = 'Failed to find nearby stations';
		}
		quickFuelLoading = false;
	}

	async function fallbackLocation(): Promise<{ lat: number; lng: number } | null> {
		try {
			const res = await fetch('/api/geolocate');
			if (res.ok) {
				const data = await res.json();
				if (data.lat && data.lng) {
					return { lat: data.lat, lng: data.lng };
				}
			}
		} catch {}
		return null;
	}

	function applyPosition(lat: number, lng: number, callback?: () => void) {
		userPosition = { lat, lng };
		searchedLocation = null;
		setLastPosition(lat, lng);
		updateUserMarker();
		if (map) map.flyTo([lat, lng], 14, { duration: 0.8 });
		callback?.();
	}

	async function getNativePosition(): Promise<{ lat: number; lng: number } | null> {
		if (!Capacitor.isNativePlatform()) return null;
		try {
			const { Geolocation } = await import('@capacitor/geolocation');
			const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
			return { lat: pos.coords.latitude, lng: pos.coords.longitude };
		} catch {
			return null;
		}
	}

	async function requestLocation() {
		const nativePos = await getNativePosition();
		if (nativePos) {
			applyPosition(nativePos.lat, nativePos.lng);
			return;
		}
		if (!navigator.geolocation) {
			const pos = await fallbackLocation();
			if (pos) applyPosition(pos.lat, pos.lng);
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				applyPosition(pos.coords.latitude, pos.coords.longitude);
			},
			async () => {
				const pos = await fallbackLocation();
				if (pos) applyPosition(pos.lat, pos.lng);
			}
		);
	}

	async function locateMe(callback?: () => void) {
		const nativePos = await getNativePosition();
		if (nativePos) {
			applyPosition(nativePos.lat, nativePos.lng, callback);
			return;
		}
		if (!navigator.geolocation) {
			const pos = await fallbackLocation();
			if (pos) applyPosition(pos.lat, pos.lng, callback);
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				applyPosition(pos.coords.latitude, pos.coords.longitude, callback);
			},
			async () => {
				const pos = await fallbackLocation();
				if (pos) applyPosition(pos.lat, pos.lng, callback);
			}
		);
	}

	function updateUserMarker() {
		if (!L || !map || !userPosition) return;
		if (userMarker) userMarker.remove();
		userMarker = L.circleMarker([userPosition.lat, userPosition.lng], {
			radius: 8,
			fillColor: '#3b82f6',
			fillOpacity: 1,
			color: '#ffffff',
			weight: 3,
			opacity: 1
		}).addTo(map);
	}

	onMount(() => {
		isMobile = window.innerWidth < 640;
		const onResize = () => {
			isMobile = window.innerWidth < 640;
		};
		window.addEventListener('resize', onResize);

		(async () => {
			try {
				loadLocations();
				await initMap();
				requestLocation();
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to load map data';
				loading = false;
			}
		})();

		return () => window.removeEventListener('resize', onResize);
	});
</script>

<svelte:head>
	<title>Fuel Scout NSW — Live NSW Fuel Price Map</title>
	<meta
		name="description"
		content="Real-time NSW fuel prices on an interactive map. Compare E10, Unleaded, Premium 95/98, Diesel and more across all NSW service stations."
	/>
	<meta property="og:title" content="Fuel Scout NSW — Live NSW Fuel Price Map" />
	<meta
		property="og:description"
		content="Real-time NSW fuel prices on an interactive map. Compare prices across all NSW service stations."
	/>
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<div class="relative flex h-[calc(100vh-3.5rem)] overflow-hidden">
	<!-- Desktop: search + fuel type at top -->
	<div
		class="hidden sm:flex absolute top-3 left-1/2 -translate-x-1/2 z-[1000] items-start gap-2"
	>
		<SearchBar
			bind:value={searchQuery}
			{suggestions}
			{showSuggestions}
			resultCount={filteredStations.length}
			oninput={onSearchInput}
			onselect={selectSuggestion}
			onclear={clearSearch}
			onfocus={() => (showSuggestions = true)}
			onblur={() => setTimeout(() => (showSuggestions = false), 200)}
		/>
		<FuelTypeSelector selected={selectedFuelType} onchange={onFuelTypeChange} />
		<button
			onclick={() => onOpenOnlyChange(!openOnly)}
			class="flex items-center gap-1.5 bg-white rounded-lg shadow-lg px-3 py-2 text-sm font-medium text-gray-700 whitespace-nowrap shrink-0 active:bg-gray-50"
		>
			<span class="inline-block w-2 h-2 rounded-full {openOnly ? 'bg-green-500' : 'bg-gray-300'}"></span>
			{openOnly ? 'Open' : 'All'}
		</button>
		{#if !showStationList}
			<button
				onclick={() => (showStationList = true)}
				class="flex items-center gap-1.5 bg-white rounded-lg shadow-lg px-3 py-2 text-sm font-medium text-gray-700 whitespace-nowrap shrink-0 active:bg-gray-50"
				aria-label="Station list"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
				List
			</button>
		{/if}
	</div>

	<!-- Mobile: search + fuel dropdown at top -->
	{#if !hideMobileControls}
		<div class="sm:hidden absolute top-3 left-3 right-3 z-[1000]">
			<div class="flex items-start gap-2">
				<div class="flex-1 min-w-0">
					<SearchBar
						fluid
						bind:value={searchQuery}
						{suggestions}
						{showSuggestions}
						resultCount={filteredStations.length}
						oninput={onSearchInput}
						onselect={selectSuggestion}
						onclear={clearSearch}
						onfocus={() => (showSuggestions = true)}
						onblur={() => setTimeout(() => (showSuggestions = false), 200)}
					/>
				</div>
				<FuelTypeSelector
					selected={selectedFuelType}
					onchange={onFuelTypeChange}
					variant="dropdown"
				/>
			</div>
		<button
			onclick={() => onOpenOnlyChange(!openOnly)}
			class="mt-1.5 flex items-center gap-1.5 bg-white rounded-lg shadow-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 whitespace-nowrap active:bg-gray-50"
		>
			<span class="inline-block w-1.5 h-1.5 rounded-full {openOnly ? 'bg-green-500' : 'bg-gray-300'}"></span>
			{openOnly ? 'Open now' : 'All'}
		</button>
		</div>
	{/if}

	<!-- Mobile: legend at bottom-left, in-line with locate button -->
	{#if !hideMobileControls}
		<div class="sm:hidden absolute bottom-40 left-3 z-[1000]">
			<Legend fuelType={selectedFuelType} min={priceRange.min} max={priceRange.max} />
		</div>
	{/if}

	<!-- Desktop: legend at bottom-left -->
	{#if !hideMobileControls}
		<div class="hidden sm:block absolute bottom-6 left-3 z-[1000]">
			<Legend fuelType={selectedFuelType} min={priceRange.min} max={priceRange.max} />
		</div>
	{/if}

	{#if !hideMobileControls}
		<LocateButton onclick={() => locateMe()} />
	{/if}

	{#if !hideMobileControls && !showSuggestions}
		<QuickFuelButton onclick={openQuickFuel} loading={quickFuelLoading} />
	{/if}

	{#if !hideMobileControls && !showSuggestions && !showStationList}
		<button
			onclick={() => (showStationList = true)}
			class="sm:hidden absolute top-[72px] right-3 z-[1001]
				bg-white hover:bg-gray-50 active:bg-gray-100
				text-gray-700 font-semibold text-sm shadow-lg rounded-full
				w-10 h-10
				transition-all active:scale-95 flex items-center justify-center whitespace-nowrap"
			aria-label="Station list"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
		</button>
	{/if}

	<div bind:this={mapContainer} class="flex-1"></div>

	{#if loading}
		<div class="absolute inset-0 flex items-center justify-center bg-white/80 z-[1004]">
			<div class="flex items-center gap-2 text-gray-600">
				<svg
					class="animate-spin h-4 w-4"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					><circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					/><path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
					/></svg
				>
				Loading fuel prices...
			</div>
		</div>
	{/if}

	{#if error}
		<div
			class="absolute top-16 left-1/2 -translate-x-1/2 z-[1004] bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm max-w-md text-center"
		>
			{error}
			<button onclick={() => (error = '')} class="ml-2 font-bold">&times;</button>
		</div>
	{/if}

	{#if (resolvedStation || showQuickFuel || (showStationList && isMobile)) && isMobile}
		<div
			class="absolute inset-0 bg-black/30 z-[1002]"
			role="button"
			aria-label="Close panel"
			tabindex="0"
			onclick={closeAllPanels}
			onkeydown={(e) => e.key === 'Escape' && closeAllPanels()}
		></div>
	{/if}

	{#if resolvedStation}
		<StationPanel station={resolvedStation} onclose={closePanel} />
	{/if}

	{#if showQuickFuel}
		<QuickFuelSheet
			stations={quickFuelStations}
			fuelType={selectedFuelType}
			onclose={() => (showQuickFuel = false)}
		/>
	{/if}

	{#if showStationList}
		<StationListPanel
			stations={searchQuery.trim() ? filteredStations : stations}
			fuelType={selectedFuelType}
			{userPosition}
			hoveredStationCode={hoveredStationCode}
			onclose={() => (showStationList = false)}
			onselect={(station) => { showStationList = false; selectStation(station); }}
			onhover={(station) => { showStationHover(station.properties.code); hoveredStationCode = station.properties.code; }}
			onleave={() => { hideStationHover(); hoveredStationCode = null; }}
		/>
	{/if}
</div>

{#if showOnboarding}
	<Onboarding onselect={completeOnboarding} />
{/if}

<style>
	:global(.price-label) {
		color: #fff;
		font-size: 11px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 8px;
		white-space: nowrap;
		text-align: center;
		border: 1px solid rgba(0, 0, 0, 0.2);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		line-height: 1.4;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	:global(.price-label-hover) {
		transform: scale(1.2);
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
		z-index: 10000 !important;
		position: relative;
	}

	:global(.price-label-discounted) {
		position: relative;
		padding-right: 18px;
	}
	:global(.discount-badge) {
		position: absolute;
		top: -5px;
		right: -6px;
		background: #16a34a;
		color: #fff;
		font-size: 8px;
		font-weight: 700;
		padding: 1px 3px;
		border-radius: 6px;
		line-height: 1.2;
		white-space: nowrap;
		border: 1px solid rgba(255, 255, 255, 0.6);
	}
	:global(.price-label-strikethrough) {
		text-decoration: line-through;
		color: #94a3b8;
		font-weight: 400;
		font-size: 10px;
	}

	:global(.station-tooltip-container) {
		border: none !important;
		border-radius: 10px !important;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15) !important;
		padding: 0 !important;
		opacity: 1 !important;
	}

	:global(.station-tooltip-container .leaflet-tooltip-content) {
		margin: 0;
	}

	:global(.station-tooltip-container::before) {
		border-top-color: #1e293b !important;
	}

	:global(.station-tooltip) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		min-width: 160px;
	}

	:global(.tooltip-name) {
		font-weight: 700;
		font-size: 13px;
		color: #1e293b;
		padding: 8px 10px 2px;
		line-height: 1.3;
	}

	:global(.tooltip-suburb) {
		font-size: 11px;
		color: #64748b;
		padding: 0 10px 6px;
		border-bottom: 1px solid #e2e8f0;
		margin-bottom: 4px;
	}

	:global(.tooltip-fuels) {
		padding: 4px 10px 8px;
	}

	:global(.fuel-row) {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 0;
		font-size: 12px;
		color: #334155;
	}

	:global(.fuel-row.highlighted) {
		background: #f1f5f9;
		margin: 0 -10px;
		padding: 2px 10px;
		border-radius: 3px;
	}

	:global(.fuel-dot) {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	:global(.fuel-name) {
		flex: 1;
		color: #475569;
		font-size: 11px;
	}

	:global(.fuel-price) {
		font-variant-numeric: tabular-nums;
		font-size: 12px;
		color: #1e293b;
	}

	:global(.marker-cluster) {
		border-radius: 50%;
	}
</style>
