<script lang="ts">
	import {
		getCategoryGroups,
		getLastVerifiedDate,
	} from '@fuelnsw/shared/utils/discounts';
	import {
		getSelectedDiscounts,
		toggleDiscount,
		clearDiscounts,
		getDiscountCount,
	} from '$lib/discount-state.svelte';

	let {
		onclose,
	}: {
		onclose?: () => void;
	} = $props();

	const groups = getCategoryGroups();
	const lastVerified = getLastVerifiedDate();
	const verifiedLabel = new Date(lastVerified + 'T00:00:00').toLocaleDateString('en-AU', {
		month: 'long',
		year: 'numeric',
	});

	function formatMonth(dateStr: string): string {
		return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
			month: 'short',
			year: 'numeric',
		});
	}
</script>

<svelte:head>
	<title>Fuel Discounts — Fuel Scout NSW</title>
</svelte:head>

<div class="fixed inset-0 z-[2001] flex items-end sm:items-center justify-center">
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
	<div class="absolute inset-0 bg-black/50" onclick={onclose} role="button" tabindex="-1" aria-label="Close"></div>
	<div class="relative bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl sm:max-h-[85vh] max-h-[90vh] flex flex-col z-10 sm:rounded-b-2xl rounded-t-2xl">
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-3 border-b shrink-0">
			<div class="flex items-center gap-2">
				<h2 class="text-lg font-bold text-gray-900">Fuel Discounts</h2>
				{#if getDiscountCount() > 0}
					<span class="bg-green-600 text-white text-xs font-semibold rounded-full px-2 py-0.5">{getDiscountCount()}</span>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if getDiscountCount() > 0}
					<button
						onclick={clearDiscounts}
						class="text-xs text-red-500 hover:text-red-700 font-medium"
					>Clear all</button>
				{/if}
				<button onclick={onclose} class="p-1 rounded-md hover:bg-gray-100 text-gray-400" aria-label="Close">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
				</button>
			</div>
		</div>

		<!-- Scrollable content -->
		<div class="overflow-y-auto flex-1 px-4 py-3 space-y-5">
			<p class="text-sm text-gray-500">Select the discount programs you have access to. Discounted prices will be shown across the map and station details.</p>

			{#each groups as group}
				<div>
					<h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.name}</h3>
					<div class="space-y-1">
						{#each group.discounts as discount}
							{@const isActive = getSelectedDiscounts().includes(discount.id)}
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
							<button
								class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left {isActive ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'}"
								onclick={() => toggleDiscount(discount.id)}
								role="switch"
								aria-checked={isActive}
								tabindex="0"
							>
								<div class="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors {isActive ? 'bg-green-600 border-green-600' : 'border-gray-300'}">
									{#if isActive}
										<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
									{/if}
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="text-sm font-medium text-gray-900 truncate">{discount.name}</span>
										<span class="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
											{#if discount.fuelTypeOverrides}
												from {discount.amount}c/L
											{:else}
												{discount.amount}c/L
											{/if}
										</span>
									</div>
									<p class="text-xs text-gray-500 mt-0.5 line-clamp-2">{discount.description}</p>
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<!-- Footer -->
		<div class="border-t px-4 py-3 shrink-0 space-y-2">
			<button
				onclick={onclose}
				class="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-2.5 rounded-xl transition-colors"
			>Done</button>
			<p class="text-[10px] text-gray-400 text-center">Discount data last verified: {verifiedLabel}</p>
		</div>
	</div>
</div>
