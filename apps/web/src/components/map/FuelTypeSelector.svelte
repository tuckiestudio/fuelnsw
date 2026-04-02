<script lang="ts">
	import { FUEL_OPTIONS } from '@fuelnsw/shared/utils/fuel-types';

	let {
		selected,
		onchange,
		variant = 'pills'
	}: {
		selected: string;
		onchange?: (fuelType: string) => void;
		variant?: 'pills' | 'dropdown';
	} = $props();

	let open = $state(false);
	let container: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!open) return;
		function onClick(e: MouseEvent) {
			if (container && !container.contains(e.target as Node)) {
				open = false;
			}
		}
		document.addEventListener('click', onClick);
		return () => document.removeEventListener('click', onClick);
	});
</script>

{#if variant === 'dropdown'}
	<div class="relative" bind:this={container}>
		<button
			onclick={() => (open = !open)}
			class="flex items-center gap-1.5 bg-white rounded-lg shadow-lg px-3 py-2 text-sm font-medium text-gray-700 whitespace-nowrap active:bg-gray-50"
		>
			{selected}
			<svg
				class="h-3.5 w-3.5 text-gray-400 transition-transform {open ? 'rotate-180' : ''}"
				viewBox="0 0 12 12"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M3 5l3 3 3-3" />
			</svg>
		</button>
		{#if open}
			<div
				class="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-lg py-1 min-w-[100px]"
			>
				{#each FUEL_OPTIONS as fuel}
					<button
						onclick={() => {
							onchange?.(fuel);
							open = false;
						}}
						class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 {selected === fuel
							? 'bg-green-50 text-green-700 font-medium'
							: 'text-gray-700'}"
					>
						{fuel}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{:else}
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
{/if}
