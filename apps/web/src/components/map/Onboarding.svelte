<script lang="ts">
	import { FUEL_OPTIONS } from '@fuelnsw/shared/utils/fuel-types';

	let {
		onselect
	}: {
		onselect?: (fuelType: string) => void;
	} = $props();

	let selected: string = $state('E10');
</script>

<div class="absolute inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
	<div class="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
		<div class="text-center mb-5">
			<div class="w-14 h-14 bg-green-600 rounded-xl flex items-center justify-center mx-auto mb-3">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M3 22V6l4-2v18H3zm6 0V8l4 2v12H9zm6 0V4l4 4v14h-4z"/></svg>
			</div>
			<h2 class="text-xl font-bold text-gray-900">Welcome to FuelNSW</h2>
			<p class="text-sm text-gray-500 mt-1">Select your usual fuel type to get started</p>
		</div>

		<div class="grid grid-cols-3 gap-2 mb-5">
			{#each FUEL_OPTIONS as fuel}
				<button
					onclick={() => (selected = fuel)}
					class="py-2.5 px-2 rounded-lg text-sm font-medium transition-all border-2 {selected === fuel
						? 'bg-green-600 text-white border-green-600 shadow-md'
						: 'bg-gray-50 text-gray-700 border-gray-200 hover:border-green-300'}"
				>
					{fuel}
				</button>
			{/each}
		</div>

		<button
			onclick={() => onselect?.(selected)}
			class="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-md"
		>
			Get Started
		</button>
	</div>
</div>
