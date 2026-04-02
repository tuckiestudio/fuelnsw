<script lang="ts">
	let {
		fuelType,
		min,
		max
	}: {
		fuelType: string;
		min: number;
		max: number;
	} = $props();
</script>

{#if min !== max}
	<div class="bg-white rounded-lg shadow-lg p-2 sm:p-3 text-xs inline-block">
		<div class="font-medium mb-1.5 text-gray-700">{fuelType} Prices</div>
		<div class="flex items-center gap-1.5">
			<span class="text-green-600 font-medium">{min.toFixed(1)}</span>
			<div
				class="w-20 h-2 rounded bg-gradient-to-r from-green-500 via-yellow-500 via-orange-400 to-red-500"
			></div>
			<span class="text-red-600 font-medium">{max.toFixed(1)}</span>
		</div>
	</div>
{/if}
