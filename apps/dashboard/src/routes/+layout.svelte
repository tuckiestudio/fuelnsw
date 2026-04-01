<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<title>FuelNSW Dashboard</title>
	<meta name="description" content="NSW Fuel Price Dashboard — Compare prices across SA4 regions, brands and fuel types." />
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col">
	<nav class="bg-white shadow-sm border-b border-gray-200 z-50 relative">
		<div class="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-14">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M3 22V6l4-2v18H3zm6 0V8l4 2v12H9zm6 0V4l4 4v14h-4z"/></svg>
					</div>
					<span class="font-bold text-lg text-gray-900">FuelNSW</span>
					<span class="text-sm text-gray-500">Dashboard</span>
				</div>
			</div>
		</div>
	</nav>

	<main class="flex-1">
		{@render children()}
	</main>
</div>
