<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { FUEL_OPTIONS } from '@fuelnsw/shared/utils/fuel-types';
	import { calculateDiscount } from '@fuelnsw/shared/utils/discounts';
	import { getSelectedDiscounts } from '$lib/discount-state.svelte';
	import PriceChart from '$components/station/PriceChart.svelte';
	import type { StationGeoJSON, OpeningHours } from '@fuelnsw/shared/api/types';
	import { maybeShowInterstitial } from '$lib/ads';
	import { getRemoveAds } from '$lib/preferences';
	import { navigateTo } from '$lib/navigation';
	import { Capacitor } from '@capacitor/core';
	import AdSlot from '$components/AdSlot.svelte';
	import SuggestHours from '$components/station/SuggestHours.svelte';
	import NavAppPicker from '$components/map/NavAppPicker.svelte';

	async function hapticImpact(style: 'Light' | 'Medium' | 'Heavy' = 'Medium') {
		if (!Capacitor.isNativePlatform()) return;
		try {
			const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
			await Haptics.impact({ style: ImpactStyle[style] });
		} catch {}
	}

	let {
		station,
		isOpen,
		onclose
	}: {
		station: StationGeoJSON;
		isOpen?: boolean;
		onclose?: () => void;
	} = $props();

	let sheetEl: HTMLDivElement;
	let sheetHeight = $state(browser ? Math.round(window.innerHeight * 0.5) : 0);
	let animated = $state(true);
	let isMobile = $state(browser ? window.innerWidth < 640 : false);
	let adsRemoved = $state(getRemoveAds());

	let snapHalf = browser ? Math.round(window.innerHeight * 0.5) : 0;
	let snapFull = browser ? Math.round(window.innerHeight * 0.9) : 0;
	let isDragging = false;
	let wasDrag = false;
	let dismissing = false;
	let dragStartY = 0;
	let dragStartHeight = 0;

	let isCollapsed = $derived(sheetHeight < snapFull && sheetHeight > 0);

	let showSuggestHours = $state(false);
	let suggestionSubmitted = $state(false);
	let showNavPicker = $state(false);

	let openStatus = $derived((): { label: string; color: string; hours: string[] } | null => {
		const hoursJson = station.properties.opening_hours as string | null | undefined;
		const open = isOpen ?? station.properties.is_open;
		if (!hoursJson) return null;
		try {
			const parsed = JSON.parse(hoursJson) as OpeningHours;
			const label = open ? 'Open' : 'Closed';
			const color = open ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200';
			return { label, color, hours: parsed.weekdayText };
		} catch {
			return null;
		}
	});

	onMount(() => {
		adsRemoved = getRemoveAds();
		snapHalf = Math.round(window.innerHeight * 0.5);
		snapFull = Math.round(window.innerHeight * 0.9);
		sheetHeight = snapHalf;
		animated = true;

		const onResize = () => {
			isMobile = window.innerWidth < 640;
			snapHalf = Math.round(window.innerHeight * 0.5);
			snapFull = Math.round(window.innerHeight * 0.9);
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	$effect(() => {
		station;
		if (snapHalf > 0) {
			dismissing = false;
			sheetHeight = snapHalf;
			animated = true;
			hapticImpact('Medium');
		}
	});

	function onTouchStart(e: TouchEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.sheet-handle') || dismissing) return;
		isDragging = true;
		wasDrag = false;
		animated = false;
		dragStartY = e.touches[0].clientY;
		dragStartHeight = sheetHeight;
		document.addEventListener('touchmove', onTouchMove, { passive: false });
		document.addEventListener('touchend', onDragEnd);
		document.addEventListener('touchcancel', onDragEnd);
	}

	function onTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		e.preventDefault();
		wasDrag = true;
		const dy = dragStartY - e.touches[0].clientY;
		sheetHeight = Math.max(0, Math.min(snapFull, dragStartHeight + dy));
	}

	async function onDragEnd() {
		if (!isDragging) return;
		isDragging = false;
		animated = true;
		document.removeEventListener('touchmove', onTouchMove);
		document.removeEventListener('touchend', onDragEnd);
		document.removeEventListener('touchcancel', onDragEnd);

		if (sheetHeight < snapHalf * 0.35) {
			dismissing = true;
			sheetHeight = 0;
			hapticImpact('Light');
			setTimeout(() => {
				if (dismissing) {
					dismissing = false;
					onclose?.();
				}
			}, 300);
			return;
		}

		const midpoint = (snapHalf + snapFull) / 2;
		if (sheetHeight >= midpoint) {
			await maybeShowInterstitial();
		}
		sheetHeight = sheetHeight < midpoint ? snapHalf : snapFull;
	}

	async function toggleSnap() {
		if (wasDrag || dismissing) return;
		animated = true;
		if (sheetHeight < snapFull) {
			await maybeShowInterstitial();
		}
		sheetHeight = sheetHeight >= snapFull ? snapHalf : snapFull;
		hapticImpact('Light');
	}

	async function handleNavigate() {
		const result = await navigateTo(station.geometry.coordinates[1], station.geometry.coordinates[0], station.properties.name);
		if (!result.ok && result.reason === 'needs_choice') {
			showNavPicker = true;
		}
	}
</script>

<svelte:head>
	<title>{station.properties.name} — Fuel Scout NSW</title>
</svelte:head>

<div
	class="z-[1003] bg-white shadow-xl flex flex-col overflow-hidden
		absolute bottom-0 left-0 right-0 rounded-t-2xl
		sm:bottom-auto sm:top-0 sm:right-0 sm:left-auto sm:w-96 sm:h-full sm:rounded-none sm:border-l sm:border-gray-200"
	style={isMobile ? `height: ${sheetHeight}px; max-height: 100vh; transition: ${animated ? 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'}` : ''}
	bind:this={sheetEl}
>
	{#if !adsRemoved}
		<div class="shrink-0 bg-gray-50 border-b border-gray-200" style="height:90px;position:relative">
			<div class="absolute inset-0 overflow-hidden">
				<AdSlot />
			</div>
		</div>
	{/if}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		role="button"
		tabindex="0"
		class="sm:hidden sheet-handle flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
		ontouchstart={onTouchStart}
		onclick={toggleSnap}
	>
		<div class="w-10 h-1 bg-gray-300 rounded-full"></div>
	</div>
	<div class="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 shrink-0">
		<div class="flex items-center gap-2 min-w-0 pr-2">
			<h2 class="font-bold text-base sm:text-lg text-gray-900 truncate">{station.properties.name}</h2>
			{#if openStatus()}
				<span class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border {openStatus()!.color}">
					{openStatus()!.label}
				</span>
			{/if}
		</div>
		<button onclick={onclose} aria-label="Close panel" class="p-1 rounded-md hover:bg-gray-100 text-gray-500 shrink-0">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
		</button>
	</div>
	<div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4" style="-webkit-overflow-scrolling:touch">
		<div class="space-y-4">
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

			<button
			type="button"
			onclick={handleNavigate}
			class="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium transition-colors"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
			Navigate
		</button>

			{#if openStatus() && openStatus()!.hours.length > 0}
				<div>
					<div class="text-gray-500 text-xs">Opening Hours</div>
					<div class="text-sm space-y-0.5 mt-0.5">
						{#each openStatus()!.hours as line}
							<div class={line.toLowerCase().startsWith(new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase()) ? 'font-medium text-gray-900' : 'text-gray-600'}>{line}</div>
						{/each}
					</div>
				</div>
			{:else if !openStatus()}
				<div>
					<div class="text-gray-500 text-xs mb-1">Opening Hours</div>
					{#if suggestionSubmitted}
						<p class="text-sm text-green-700">Thanks! Your suggestion has been submitted for review.</p>
					{:else}
						<div class="flex items-center gap-2">
							<span class="text-sm text-gray-500 italic">Hours unavailable</span>
							<button
								onclick={() => (showSuggestHours = true)}
								class="text-xs text-green-700 hover:text-green-800 font-medium underline underline-offset-2"
							>
								Suggest hours
							</button>
						</div>
					{/if}
				</div>
			{/if}

			<hr class="border-gray-200">

			<div>
				<div class="text-sm font-medium text-gray-700 mb-2">Current Prices</div>
				<div class="space-y-1">
					{#each FUEL_OPTIONS as fuel}
						{@const price = station.properties[fuel]}
						{#if price && typeof price === 'string'}
							{@const discount = calculateDiscount(station.properties.brand || '', fuel, getSelectedDiscounts())}
							{@const discountedPrice = Math.max(0, parseFloat(price) - discount.totalDiscount)}
							<div class="flex justify-between items-center py-1.5 px-2.5 bg-gray-50 rounded-md">
								<span class="text-sm">{fuel}</span>
								<div class="flex items-center gap-1.5">
									{#if discount.totalDiscount > 0}
										<span class="text-xs text-gray-400 line-through">{parseFloat(price).toFixed(1)}</span>
										<span class="font-bold text-sm text-green-700">{discountedPrice.toFixed(1)} c/L</span>
										<span class="text-[10px] font-medium text-green-600 bg-green-50 px-1 py-0.5 rounded">-{discount.totalDiscount.toFixed(1)}</span>
									{:else}
										<span class="font-bold text-sm">{parseFloat(price).toFixed(1)} c/L</span>
									{/if}
								</div>
							</div>
						{:else}
							<div class="flex justify-between items-center py-1.5 px-2.5 bg-gray-50 rounded-md opacity-50">
								<span class="text-sm text-gray-500">{fuel}</span>
								<span class="text-xs text-gray-400 italic">Not reported</span>
							</div>
						{/if}
					{/each}
				</div>
			</div>

			<hr class="border-gray-200">

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
						{:else}
							<div class="py-3 px-2.5 bg-gray-50 rounded-md text-center">
								<div class="text-xs text-gray-400">{fuel} — Not reported by this station</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

{#if showSuggestHours}
	<SuggestHours
		stationCode={station.properties.code}
		onclose={() => (showSuggestHours = false)}
		onsubmitted={() => { showSuggestHours = false; suggestionSubmitted = true; }}
	/>
{/if}

{#if showNavPicker}
	<NavAppPicker
		lat={station.geometry.coordinates[1]}
		lng={station.geometry.coordinates[0]}
		name={station.properties.name}
		onclose={() => (showNavPicker = false)}
	/>
{/if}
