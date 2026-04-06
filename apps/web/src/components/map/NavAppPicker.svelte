<script lang="ts">
	import { NAV_APPS, navigateWithApp, type NavApp } from '$lib/navigation';

	let {
		lat,
		lng,
		name,
		onclose
	}: {
		lat: number;
		lng: number;
		name?: string;
		onclose: () => void;
	} = $props();

	async function select(app: NavApp) {
		await navigateWithApp(lat, lng, app, name);
		onclose();
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center" onclick={onclose}>
	<div class="absolute inset-0 bg-black/40"></div>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="relative w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-white rounded-2xl shadow-xl overflow-hidden" onclick={(e) => e.stopPropagation()}>
		<div class="p-4 pb-2 text-center">
			<h3 class="text-base font-semibold text-gray-900">Choose Navigation App</h3>
			<p class="text-xs text-gray-500 mt-0.5">Your choice will be remembered</p>
		</div>
		<div class="px-3 pb-3 space-y-1.5">
			{#each NAV_APPS as app}
				<button
					onclick={() => select(app.id)}
					class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
				>
					<div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
						{#if app.id === 'apple'}
							<svg class="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
						{:else}
							<svg class="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
						{/if}
					</div>
					<span class="font-medium text-sm text-gray-900">{app.label}</span>
				</button>
			{/each}
		</div>
		<div class="border-t border-gray-200 px-3 pb-3 pt-2">
			<button
				onclick={onclose}
				class="w-full py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition-colors"
			>
				Cancel
			</button>
		</div>
	</div>
</div>
