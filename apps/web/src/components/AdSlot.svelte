<script lang="ts">
	import { onMount } from 'svelte';
	import { tick } from 'svelte';
	import { browser } from '$app/environment';
	import { Capacitor } from '@capacitor/core';
	import { WEB_AD_SLOT } from '$lib/ads';
	import { dev } from '$app/environment';

	let {
		format = 'auto',
		class: className = ''
	}: {
		format?: string;
		class?: string;
	} = $props();

	let showAd = $state(false);

	onMount(() => {
		if (dev || Capacitor.isNativePlatform()) return;
		showAd = true;
		tick().then(() => {
			try {
				const w = window as any;
				(w.adsbygoogle = w.adsbygoogle || []).push({});
			} catch {}
		});
	});
</script>

{#if !Capacitor.isNativePlatform()}
	{#if dev}
		<div class={className} style="height:50px;overflow:hidden">
			<div class="w-full h-full bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center rounded">
				<span class="text-xs text-gray-400">Ad</span>
			</div>
		</div>
	{:else if showAd}
		<div class={className} style="height:50px;overflow:hidden">
			<ins
				class="adsbygoogle"
				style="display:block;width:100%;height:50px"
				data-ad-client="ca-pub-8792853309353392"
				data-ad-slot={WEB_AD_SLOT}
				data-ad-format={format}
			></ins>
		</div>
	{/if}
{/if}
