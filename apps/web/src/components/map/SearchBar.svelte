<script lang="ts">
	let {
		value = $bindable(''),
		suggestions = [],
		showSuggestions = false,
		resultCount = 0,
		oninput,
		onselect,
		onclear,
		onfocus,
		onblur,
		fluid = false
	}: {
		value: string;
		suggestions: { postcode: string; suburb: string }[];
		showSuggestions: boolean;
		resultCount: number;
		oninput?: () => void;
		onselect?: (postcode: string) => void;
		onclear?: () => void;
		onfocus?: () => void;
		onblur?: () => void;
		fluid?: boolean;
	} = $props();
</script>

<div class="flex flex-col gap-1 shrink-0">
	<div class="flex items-center gap-2 bg-white rounded-lg shadow-lg px-3 py-2">
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
		<input
			type="text"
			placeholder="Postcode or suburb..."
			bind:value
			oninput={oninput}
			onfocus={onfocus}
			onblur={onblur}
			class="{fluid ? 'flex-1 min-w-0' : 'w-36'} text-sm outline-none bg-transparent placeholder-gray-400"
		/>
		{#if value}
			<button onclick={onclear} aria-label="Clear search" class="text-gray-400 hover:text-gray-600 shrink-0">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
			</button>
		{/if}
	</div>
	{#if showSuggestions && suggestions.length > 0}
		<div class="bg-white rounded-lg shadow-lg max-h-60 overflow-y-auto">
			{#each suggestions as loc}
				<button
					onclick={() => onselect?.(loc.postcode)}
					class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100 last:border-0"
				>
					<span class="font-mono font-medium text-gray-700">{loc.postcode}</span>
					<span class="text-gray-500 truncate">{loc.suburb}</span>
				</button>
			{/each}
		</div>
	{/if}
	{#if value.trim() && !showSuggestions}
		<div class="bg-white rounded-lg shadow-lg px-3 py-1.5 text-xs text-gray-600">
			{resultCount} station{resultCount !== 1 ? 's' : ''} found
		</div>
	{/if}
</div>
