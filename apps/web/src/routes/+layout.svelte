<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { Capacitor } from '@capacitor/core';

	let { children }: { children: Snippet } = $props();

	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';
	import { getRemoveAds } from '$lib/preferences';
	import { showDiscountModal, discountCount } from '$lib/discount-state.svelte';
	import PaywallModal from '$components/PaywallModal.svelte';
	import DiscountModal from '$components/map/DiscountModal.svelte';

	const isNative = Capacitor.isNativePlatform();

	let showPaywall = $state(false);
	let adsRemoved = $state(isNative ? getRemoveAds() : false);

	onMount(() => {
		adsRemoved = isNative ? getRemoveAds() : false;

		if (!adsRemoved) {
			import('$lib/ads').then(({ initAds, showBanner }) => {
				initAds().then(() => {
					if (isNative) showBanner();
				});
			});
		}

		if (isNative) {
			import('$lib/subscription').then(({ configureRevenueCat, isSubscribed }) => {
				configureRevenueCat().then(() => {
					isSubscribed().then((subbed) => {
						if (subbed) {
							adsRemoved = true;
							import('$lib/ads').then(({ hideBanner }) => hideBanner());
						}
					});
				});
			});
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Fuel Scout NSW — Fuel Price Tracker</title>
	<meta name="description" content="Track real-time NSW fuel prices. Compare E10, Unleaded, Premium, Diesel prices across all NSW service stations with live maps and historical charts." />
	<meta property="og:title" content="Fuel Scout NSW — Fuel Price Tracker" />
	<meta property="og:description" content="Track real-time NSW fuel prices with live maps, historical charts, and availability monitoring." />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col">
	<nav class="bg-white shadow-sm border-b border-gray-200 z-50 relative">
		<div class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-14">
				<a href="/" class="flex items-center gap-2">
					<div class="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M3 22V6l4-2v18H3zm6 0V8l4 2v12H9zm6 0V4l4 4v14h-4z"/></svg>
					</div>
					<span class="font-bold text-lg text-gray-900">Fuel Scout NSW</span>
				</a>
				<div class="flex items-center gap-1">
					<a
						href="/"
						class="px-3 py-2 rounded-md text-sm font-medium transition-colors {$page.url.pathname === '/'
							? 'bg-green-50 text-green-700'
							: 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
					>
						Map
					</a>
					<a
						href="/summary"
						class="px-3 py-2 rounded-md text-sm font-medium transition-colors {$page.url.pathname.startsWith('/summary')
							? 'bg-green-50 text-green-700'
							: 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
					>
						Summary
					</a>
					<button
						onclick={() => (showDiscountModal = true)}
						class="hidden sm:flex px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 items-center gap-1"
					>
						Discounts
						{#if discountCount > 0}
							<span class="bg-green-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{discountCount}</span>
						{/if}
					</button>
					<button
						onclick={() => (showDiscountModal = true)}
						class="sm:hidden relative p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50"
						aria-label="Fuel discounts"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
						</svg>
						{#if discountCount > 0}
							<span class="absolute -top-0.5 -right-0.5 bg-green-600 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center">{discountCount}</span>
						{/if}
					</button>
					{#if isNative && !adsRemoved}
						<button
							onclick={() => (showPaywall = true)}
							class="px-2 py-1.5 rounded-md text-xs font-medium text-green-600 hover:bg-green-50 transition-colors flex items-center gap-1"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 008.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clip-rule="evenodd"/></svg>
							Remove Ads
						</button>
					{/if}
				</div>
			</div>
		</div>
	</nav>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="bg-white border-t border-gray-200 py-4 px-4 sm:px-6 lg:px-8">
		<div class="max-w-screen-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
			<span>© {new Date().getFullYear()} Fuel Scout NSW</span>
			<span>Fuel price data sourced from the <a href="https://api.nsw.gov.au/" target="_blank" rel="noopener noreferrer" class="underline hover:text-gray-600 transition-colors">NSW Government Fuel Check API</a></span>
		</div>
	</footer>
</div>

{#if isNative && showPaywall}
	<PaywallModal onclose={() => {
		showPaywall = false;
		adsRemoved = getRemoveAds();
	}} />
{/if}

{#if showDiscountModal}
	<DiscountModal onclose={() => (showDiscountModal = false)} />
{/if}
