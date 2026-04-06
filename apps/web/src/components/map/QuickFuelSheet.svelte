<script lang="ts">
	import { navigateTo } from '$lib/navigation';
	import { maybeShowInterstitial } from '$lib/ads';
	import { getRemoveAds } from '$lib/preferences';
	import { Capacitor } from '@capacitor/core';
	import AdSlot from '$components/AdSlot.svelte';
	import NavAppPicker from '$components/map/NavAppPicker.svelte';

	async function hapticImpact(style: 'Light' | 'Medium' | 'Heavy' = 'Medium') {
		if (!Capacitor.isNativePlatform()) return;
		try {
			const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
			await Haptics.impact({ style: ImpactStyle[style] });
		} catch {}
	}

	interface NearestStation {
		code: string;
		name: string;
		brand: string;
		suburb: string;
		address: string;
		postcode: string;
		latitude: number;
		longitude: number;
		price: number;
		distance_km: number;
		drive_minutes: number;
		is_open: boolean;
		opening_hours: string | null;
	}

	let {
		stations = [],
		fuelType,
		onclose
	}: {
		stations: NearestStation[];
		fuelType: string;
		onclose?: () => void;
	} = $props();

	let adsRemoved = $state(getRemoveAds());
	let showNavPicker = $state(false);
	let pendingNavStation: NearestStation | null = $state(null);

	async function handleNavigate(station: NearestStation) {
		hapticImpact('Medium');
		await maybeShowInterstitial();
		const result = await navigateTo(station.latitude, station.longitude, station.name);
		if (!result.ok && result.reason === 'needs_choice') {
			pendingNavStation = station;
			showNavPicker = true;
		}
	}

	let maxDistance = $derived(
		stations.length > 0
			? Math.max(...stations.map(s => s.distance_km))
			: 0
	);

	let distanceLabel = $derived(
		maxDistance <= 1 ? 'within 1km'
		: maxDistance <= 5 ? `within ${Math.ceil(maxDistance)}km`
		: maxDistance <= 20 ? `within ${Math.ceil(maxDistance)}km`
		: `within ${Math.round(maxDistance)}km`
	);
</script>

<div class="absolute bottom-0 left-0 right-0 z-[1003]">
	<div class="bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 sm:rounded-2xl sm:border max-w-md mx-auto">
		{#if !adsRemoved}
			<div class="bg-gray-50 border-b border-gray-200 rounded-t-2xl">
				<AdSlot />
			</div>
		{/if}
		<div class="flex items-center justify-between p-4 pb-2">
			<div>
				<h3 class="font-bold text-gray-900">Cheapest {fuelType} nearby</h3>
				<p class="text-xs text-gray-500">Showing results {distanceLabel}</p>
			</div>
			<button onclick={onclose} aria-label="Close" class="p-1 rounded-md hover:bg-gray-100 text-gray-400">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
			</button>
		</div>
		<div class="px-4 pb-4 space-y-2">
			{#each stations.slice(0, 3) as station, i}
				<button
					onclick={() => handleNavigate(station)}
					class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left border border-gray-100"
				>
					<div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 {i === 0
						? 'bg-green-100 text-green-700'
						: 'bg-gray-100 text-gray-500'}">
						{#if i === 0}
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.97.757l.5 2a1 1 0 01-.27.94l-1.5 1.5a11.048 11.048 0 005.514 5.514l1.5-1.5a1 1 0 01.94-.27l2 .5a1 1 0 01.757.97v2.5a1 1 0 01-1 1A16.001 16.001 0 012 4a1 1 0 011-1h2.5z" clip-rule="evenodd"/></svg>
						{:else}
							<span class="text-xs font-bold">{i + 1}</span>
						{/if}
					</div>
					<div class="flex-1 min-w-0">
						<div class="font-medium text-sm text-gray-900 truncate">
							{station.name}
							{#if !station.is_open}
								<span class="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded ml-1">Closed</span>
							{/if}
						</div>
						<div class="text-xs text-gray-500">
							{station.distance_km < 1
								? `${Math.round(station.distance_km * 1000)}m`
								: `${station.distance_km.toFixed(1)}km`}
							· ~{station.drive_minutes} min
						</div>
					</div>
					<div class="text-right shrink-0">
						<div class="font-bold text-green-700">{station.price.toFixed(1)}</div>
						<div class="text-[10px] text-gray-400">c/L</div>
					</div>
				</button>
			{/each}
		</div>
	</div>
</div>

{#if showNavPicker && pendingNavStation}
	<NavAppPicker
		lat={pendingNavStation.latitude}
		lng={pendingNavStation.longitude}
		name={pendingNavStation.name}
		onclose={() => { showNavPicker = false; pendingNavStation = null; }}
	/>
{/if}
