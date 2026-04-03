<script lang="ts">
	let {
		onclose
	}: {
		onclose?: () => void;
	} = $props();

	let loading = $state(false);
	let error = $state('');
	let success = $state(false);

	async function handleSubscribe() {
		loading = true;
		error = '';
		try {
			const { purchaseSubscription } = await import('$lib/subscription');
			const ok = await purchaseSubscription();
			if (ok) {
				success = true;
				setTimeout(() => onclose?.(), 1500);
			} else {
				error = 'Purchase failed. Please try again.';
			}
		} catch {
			error = 'Something went wrong.';
		}
		loading = false;
	}

	async function handleRestore() {
		loading = true;
		error = '';
		try {
			const { restorePurchases } = await import('$lib/subscription');
			const ok = await restorePurchases();
			if (ok) {
				success = true;
				setTimeout(() => onclose?.(), 1500);
			} else {
				error = 'No active subscription found.';
			}
		} catch {
			error = 'Something went wrong.';
		}
		loading = false;
	}
</script>

<svelte:head>
	<title>Remove Ads — Fuel Scout NSW</title>
</svelte:head>

<div class="fixed inset-0 z-[2000] flex items-center justify-center p-4">
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
	<div class="absolute inset-0 bg-black/50" onclick={onclose} role="button" tabindex="-1" aria-label="Close"></div>
	<div class="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 z-10">
		{#if success}
			<div class="text-center py-8">
				<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
				</div>
				<h3 class="text-lg font-bold text-gray-900">You're ad-free!</h3>
				<p class="text-sm text-gray-500 mt-1">Enjoy Fuel Scout NSW without interruptions.</p>
			</div>
		{:else}
			<div class="text-center mb-6">
				<div class="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/></svg>
				</div>
				<h3 class="text-xl font-bold text-gray-900">Remove Ads</h3>
				<p class="text-sm text-gray-500 mt-1">Enjoy an uninterrupted experience</p>
			</div>

			<div class="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-center">
				<div class="text-3xl font-bold text-green-700">$1<span class="text-base font-normal text-green-600">.00/mo</span></div>
				<p class="text-xs text-green-600 mt-1">Cancel anytime</p>
			</div>

			{#if error}
				<div class="text-sm text-red-600 text-center mb-3">{error}</div>
			{/if}

			<button
				onclick={handleSubscribe}
				disabled={loading}
				class="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-green-400 text-white font-semibold py-3 rounded-xl transition-colors mb-3"
			>
				{#if loading}
					<svg class="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
					</svg>
				{:else}
					Subscribe
				{/if}
			</button>

			<button
				onclick={handleRestore}
				disabled={loading}
				class="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
			>
				Restore Purchases
			</button>
		{/if}

		<button
			onclick={onclose}
			class="absolute top-3 right-3 p-1 rounded-md hover:bg-gray-100 text-gray-400"
			aria-label="Close"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
		</button>
	</div>
</div>
