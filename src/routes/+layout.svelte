<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/stores';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>FuelNSW — NSW Fuel Price Tracker</title>
	<meta name="description" content="Track real-time NSW fuel prices. Compare E10, Unleaded, Premium, Diesel prices across all NSW service stations with live maps and historical charts." />
	<meta property="og:title" content="FuelNSW — NSW Fuel Price Tracker" />
	<meta property="og:description" content="Track real-time NSW fuel prices with live maps, historical charts, and availability monitoring." />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col">
	<!-- Navigation -->
	<nav class="bg-white shadow-sm border-b border-gray-200 z-50 relative">
		<div class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-14">
				<a href="/" class="flex items-center gap-2">
					<div class="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M3 22V6l4-2v18H3zm6 0V8l4 2v12H9zm6 0V4l4 4v14h-4z"/></svg>
					</div>
					<span class="font-bold text-lg text-gray-900">FuelNSW</span>
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
				</div>
			</div>
		</div>
	</nav>

	<main class="flex-1">
		{@render children()}
	</main>
</div>
