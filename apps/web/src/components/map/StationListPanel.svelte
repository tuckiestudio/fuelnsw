<script lang="ts">
	import { getPriceColor } from '@fuelnsw/shared/utils/fuel-types';
	import type { StationGeoJSON } from '@fuelnsw/shared/api/types';
	import { Capacitor } from '@capacitor/core';

	async function hapticImpact(style: 'Light' | 'Medium' | 'Heavy' = 'Medium') {
		if (!Capacitor.isNativePlatform()) return;
		try {
			const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
			await Haptics.impact({ style: ImpactStyle[style] });
		} catch {}
	}

	let {
		stations = [],
		fuelType,
		userPosition,
		onclose,
		onselect
	}: {
		stations: StationGeoJSON[];
		fuelType: string;
		userPosition: { lat: number; lng: number } | null;
		onclose?: () => void;
		onselect?: (station: StationGeoJSON) => void;
	} = $props();

	type SortMode = 'price' | 'distance';
	let sortMode: SortMode = $state('price');

	function getDistance(station: StationGeoJSON): number {
		if (!userPosition) return Infinity;
		const lat = station.geometry.coordinates[1];
		const lng = station.geometry.coordinates[0];
		const dLat = lat - userPosition.lat;
		const dLng = lng - userPosition.lng;
		return Math.sqrt(dLat * dLat + dLng * dLng) * 111;
	}

	function getPrice(station: StationGeoJSON): number {
		const raw = station.properties[fuelType];
		const price = parseFloat(String(raw ?? ''));
		return isNaN(price) ? Infinity : price;
	}

	let sortedStations = $derived.by(() => {
		const withPrice = stations.filter((s) => {
			const raw = s.properties[fuelType];
			return raw != null && !isNaN(parseFloat(String(raw)));
		});
		const sorted = [...withPrice];
		if (sortMode === 'price') {
			sorted.sort((a, b) => getPrice(a) - getPrice(b));
		} else {
			sorted.sort((a, b) => getDistance(a) - getDistance(b));
		}
		return sorted;
	});

	function formatDistance(km: number): string {
		if (km === Infinity) return '--';
		if (km < 1) return `${Math.round(km * 1000)}m`;
		return `${km.toFixed(1)}km`;
	}
</script>

<div
	class="z-[1003] bg-white shadow-xl flex flex-col overflow-hidden
		absolute bottom-0 left-0 right-0 max-h-[60vh] rounded-t-2xl
		sm:bottom-auto sm:top-0 sm:right-0 sm:left-auto sm:w-96 sm:max-h-full sm:h-full sm:rounded-none sm:border-l sm:border-gray-200"
>
	<div class="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 shrink-0">
		<div class="min-w-0 pr-2">
			<h2 class="font-bold text-base sm:text-lg text-gray-900">Stations in view</h2>
			<p class="text-xs text-gray-500">{sortedStations.length} stations with {fuelType} prices</p>
		</div>
		<button onclick={onclose} aria-label="Close panel" class="p-1 rounded-md hover:bg-gray-100 text-gray-500 shrink-0">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
		</button>
	</div>

	<div class="flex shrink-0 border-b border-gray-200">
		<button
			onclick={() => { sortMode = 'price'; hapticImpact('Light'); }}
			class="flex-1 py-2 text-sm font-medium text-center transition-colors relative {sortMode === 'price' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}"
		>
			<div class="flex items-center justify-center gap-1.5">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
				Price
			</div>
			{#if sortMode === 'price'}
				<div class="absolute bottom-0 left-2 right-2 h-0.5 bg-gray-900 rounded-full"></div>
			{/if}
		</button>
		<button
			onclick={() => { sortMode = 'distance'; hapticImpact('Light'); }}
			class="flex-1 py-2 text-sm font-medium text-center transition-colors relative {sortMode === 'distance' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}"
		>
			<div class="flex items-center justify-center gap-1.5">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
				Distance
			</div>
			{#if sortMode === 'distance'}
				<div class="absolute bottom-0 left-2 right-2 h-0.5 bg-gray-900 rounded-full"></div>
			{/if}
		</button>
	</div>

	<div class="flex-1 min-h-0 overflow-y-auto overscroll-contain" style="-webkit-overflow-scrolling:touch">
		{#if sortedStations.length === 0}
			<div class="flex items-center justify-center py-12 text-gray-400 text-sm">
				No stations with {fuelType} prices in view
			</div>
		{:else}
			<div class="divide-y divide-gray-100">
				{#each sortedStations as station, i}
					{@const price = getPrice(station)}
					{@const dist = getDistance(station)}
					{@const color = getPriceColor(price, sortedStations.length > 1 ? Math.min(...sortedStations.map(getPrice)) : price, sortedStations.length > 1 ? Math.max(...sortedStations.map(getPrice)) : price)}
					<button
						onclick={() => { hapticImpact('Light'); onselect?.(station); }}
						class="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
					>
						<div class="w-8 h-6 rounded flex items-center justify-center shrink-0 text-white font-bold text-[10px] leading-none" style="background:{color}">
							{price.toFixed(1)}
						</div>
						<div class="flex-1 min-w-0">
							<div class="font-medium text-sm text-gray-900 truncate">
								{station.properties.name}
							</div>
							<div class="text-xs text-gray-500 truncate">
								{station.properties.brand ?? ''} · {station.properties.suburb}
							</div>
						</div>
						<div class="text-right shrink-0">
							{#if userPosition && dist !== Infinity}
								<div class="text-xs text-gray-500">{formatDistance(dist)}</div>
							{/if}
							<div class="text-[10px] text-gray-400">{fuelType}</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
