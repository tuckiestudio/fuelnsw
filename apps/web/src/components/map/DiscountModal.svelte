<script lang="ts">
	import {
		getCategoryGroups,
		getLastVerifiedDate,
		GIFT_CARD_BRAND_GROUPS,
	} from '@fuelnsw/shared/utils/discounts';
	import {
		getSelectedDiscounts,
		toggleDiscount,
		clearDiscounts,
		getDiscountCount,
		getGiftCardEnabledState,
		getGiftCardPercentState,
		toggleGiftCard,
		updateGiftCardPercent,
		getGiftCardBrandsState,
		updateGiftCardBrands,
	} from '$lib/discount-state.svelte';
	import { Capacitor } from '@capacitor/core';

	let {
		onclose,
	}: {
		onclose?: () => void;
	} = $props();

	const isNative = Capacitor.isNativePlatform();

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

	function isAllBrands(): boolean {
		return getGiftCardBrandsState() === null;
	}

	function toggleAllBrands(on: boolean) {
		updateGiftCardBrands(on ? null : []);
	}

	function isGroupSelected(group: { brands: string[] }): boolean {
		const brands = getGiftCardBrandsState();
		if (brands === null) return false;
		return group.brands.every((b) => brands.includes(b));
	}

	function isGroupPartiallySelected(group: { brands: string[] }): boolean {
		const brands = getGiftCardBrandsState();
		if (brands === null) return false;
		return group.brands.some((b) => brands.includes(b)) && !group.brands.every((b) => brands.includes(b));
	}

	function toggleGroup(group: { brands: string[] }) {
		const current = getGiftCardBrandsState() ?? [];
		const allSelected = group.brands.every((b) => current.includes(b));
		let next: string[];
		if (allSelected) {
			next = current.filter((b) => !group.brands.includes(b));
		} else {
			next = [...new Set([...current, ...group.brands])];
		}
		updateGiftCardBrands(next.length === 0 ? [] : next);
	}

	function getBrandBadgeText(): string {
		const brands = getGiftCardBrandsState();
		if (brands === null) return 'All brands';
		return `${brands.length} ${brands.length === 1 ? 'brand' : 'brands'}`;
	}
</script>

<svelte:head>
	<title>Fuel Discounts — Fuel Scout NSW</title>
</svelte:head>

<div class="fixed inset-0 z-[2001] flex items-end sm:items-center justify-center">
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
	<div class="absolute inset-0 bg-black/50" onclick={onclose} role="button" tabindex="-1" aria-label="Close"></div>
	<div class="relative bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl sm:max-h-[85vh] max-h-[80vh] flex flex-col z-10 sm:rounded-b-2xl rounded-t-2xl" style:margin-top={isNative ? 'env(safe-area-inset-top)' : undefined}>
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

			<div>
				<h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Gift Card Discount</h3>
				<div class="space-y-2">
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
					<button
						class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left {getGiftCardEnabledState() ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'}"
						onclick={() => toggleGiftCard(!getGiftCardEnabledState())}
						role="switch"
						aria-checked={getGiftCardEnabledState()}
						tabindex="0"
					>
						<div class="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors {getGiftCardEnabledState() ? 'bg-green-600 border-green-600' : 'border-gray-300'}">
							{#if getGiftCardEnabledState()}
								<svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
							{/if}
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-gray-900 truncate">Discount Gift Card</span>
								<span class="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">{getBrandBadgeText()}</span>
							</div>
							<p class="text-xs text-gray-500 mt-0.5">If you bought a discounted gift card (e.g. 5% off), enter the percentage discount here.</p>
						</div>
					</button>
					{#if getGiftCardEnabledState()}
						<div class="ml-8 flex items-center gap-3">
							<button
								onclick={() => updateGiftCardPercent(getGiftCardPercentState() - 1)}
								class="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors shrink-0 {getGiftCardPercentState() <= 1 ? 'opacity-40 pointer-events-none' : ''}"
								aria-label="Decrease percentage"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4"/></svg>
							</button>
							<div class="flex items-baseline gap-1">
								<span class="text-2xl font-bold text-gray-900 tabular-nums">{getGiftCardPercentState()}</span>
								<span class="text-sm font-medium text-gray-500">%</span>
							</div>
							<button
								onclick={() => updateGiftCardPercent(getGiftCardPercentState() + 1)}
								class="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors shrink-0 {getGiftCardPercentState() >= 15 ? 'opacity-40 pointer-events-none' : ''}"
								aria-label="Increase percentage"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
							</button>
						</div>
						<div class="ml-8 space-y-1.5">
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
							<button
								class="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left {isAllBrands() ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}"
								onclick={() => toggleAllBrands(!isAllBrands())}
								role="switch"
								aria-checked={isAllBrands()}
								tabindex="0"
							>
								<div class="w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors {isAllBrands() ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}" style="width:18px;height:18px">
									{#if isAllBrands()}
										<svg class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
									{/if}
								</div>
								<span class="text-sm font-medium text-gray-900">Apply to all brands</span>
							</button>
							{#if !isAllBrands()}
								{#each GIFT_CARD_BRAND_GROUPS as group}
									{@const selected = isGroupSelected(group)}
									{@const partial = isGroupPartiallySelected(group)}
									<!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
									<button
										class="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-left {selected ? 'bg-blue-50 border border-blue-200' : partial ? 'bg-blue-50/50 border border-blue-100' : 'hover:bg-gray-50 border border-transparent'}"
										onclick={() => toggleGroup(group)}
										role="switch"
										aria-checked={selected}
										tabindex="0"
									>
										<div class="shrink-0 transition-colors {selected ? 'text-blue-600' : partial ? 'text-blue-400' : 'text-gray-300'}">
											<svg class="w-4 h-4" viewBox="0 0 18 18" fill="none">
												<rect x="0.5" y="0.5" width="17" height="17" rx="3" stroke="currentColor" stroke-width="1.5" fill={selected ? 'currentColor' : 'none'}/>
												{#if selected}
													<path d="M5 9l2.5 2.5L13 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
												{:else if partial}
													<rect x="4" y="7.5" width="10" height="3" rx="1" fill="currentColor"/>
												{/if}
											</svg>
										</div>
										<span class="text-sm text-gray-700">{group.label}</span>
									</button>
								{/each}
								<p class="text-xs text-amber-700 mt-1 px-1">Select which brands accept your gift card. Percentage is applied to the price after any other selected discounts.</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>

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
		<p class="text-[10px] text-gray-400 text-center">Discount information sourced from <a href="https://www.ozbargain.com.au/wiki/fuel_discounts" target="_blank" rel="noopener noreferrer" class="underline hover:text-gray-600 transition-colors">OzBargain Fuel Discounts Wiki</a></p>
		</div>
	</div>
</div>
