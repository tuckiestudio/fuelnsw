<script lang="ts">
	import { FUEL_OPTIONS } from '@fuelnsw/shared/utils/fuel-types';

	let {
		selected,
		onchange
	}: {
		selected: string;
		onchange?: (fuelType: string) => void;
	} = $props();
</script>

<div class="flex gap-1 bg-white rounded-lg shadow-lg px-2 py-1.5 overflow-x-auto">
	{#each FUEL_OPTIONS as fuel}
		<button
			onclick={() => onchange?.(fuel)}
			class="px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap {selected === fuel
				? 'bg-green-600 text-white'
				: 'text-gray-600 hover:bg-gray-100'}"
		>
			{fuel}
		</button>
	{/each}
</div>
