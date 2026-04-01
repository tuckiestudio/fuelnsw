<script lang="ts">
	let { onclick, loading = false }: { onclick?: () => void; loading?: boolean } = $props();
</script>

<button
	onclick={onclick}
	disabled={loading}
	class="absolute top-[72px] sm:top-14 left-1/2 -translate-x-1/2 z-[1001]
		bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-green-400
		text-white font-semibold text-sm shadow-lg rounded-full
		px-5 py-2.5 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
>
	{#if loading}
		<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
		</svg>
		Finding cheapest...
	{:else}
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
			<circle cx="12" cy="10" r="3"/>
		</svg>
		Navigate to cheapest nearby
	{/if}
</button>
