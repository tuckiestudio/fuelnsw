<script lang="ts">
	const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
	const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

	let {
		stationCode,
		onclose,
		onsubmitted
	}: {
		stationCode: string;
		onclose: () => void;
		onsubmitted: () => void;
	} = $props();

	let mode: '24/7' | 'same-daily' | 'custom' = $state('same-daily');
	let submitting = $state(false);
	let error = $state('');

	let sameOpen = $state('06:00');
	let sameClose = $state('22:00');

	let customHours = $state<Record<number, { open: string; close: string }>>({
		1: { open: '06:00', close: '22:00' },
		2: { open: '06:00', close: '22:00' },
		3: { open: '06:00', close: '22:00' },
		4: { open: '06:00', close: '22:00' },
		5: { open: '06:00', close: '22:00' },
		6: { open: '07:00', close: '20:00' },
		0: { open: '08:00', close: '20:00' }
	});

	function parseTime(t: string): { hour: number; minute: number } {
		const [h, m] = t.split(':').map(Number);
		return { hour: h, minute: m };
	}

	function formatTime12(t: string): string {
		const { hour, minute } = parseTime(t);
		const period = hour >= 12 ? 'PM' : 'AM';
		const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
		return `${h12}:${minute.toString().padStart(2, '0')} ${period}`;
	}

	function buildPayload(): { periods: Array<{ open: { day: number; hour: number; minute: number }; close: { day: number; hour: number; minute: number } }>; weekdayText: string[] } {
		const weekdayText: string[] = [];
		const periods: Array<{ open: { day: number; hour: number; minute: number }; close: { day: number; hour: number; minute: number } }> = [];

		if (mode === '24/7') {
			for (let d = 0; d < 7; d++) {
				periods.push({ open: { day: d, hour: 0, minute: 0 }, close: { day: d, hour: 0, minute: 0 } });
			}
			return { periods, weekdayText: DAYS.map(d => `${d}: 24/7`) };
		}

		for (let d = 0; d < 7; d++) {
			const hours = mode === 'same-daily'
				? { open: sameOpen, close: sameClose }
				: customHours[d] || { open: '00:00', close: '00:00' };

			const openTime = parseTime(hours.open);
			const closeTime = parseTime(hours.close);

			weekdayText.push(`${DAYS[d]}: ${formatTime12(hours.open)} – ${formatTime12(hours.close)}`);
			periods.push({ open: { day: d, ...openTime }, close: { day: d, ...closeTime } });
		}

		return { periods, weekdayText };
	}

	async function submit() {
		submitting = true;
		error = '';
		try {
			const payload = buildPayload();
			const res = await fetch(`/api/fuel/station/${stationCode}/suggest-hours`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const data = await res.json();
			if (!res.ok) {
				error = data.error || 'Failed to submit';
				return;
			}
			onsubmitted();
		} catch {
			error = 'Network error';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onclick={onclose}>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="bg-white rounded-2xl shadow-2xl p-5 mx-4 max-w-sm w-full max-h-[85vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-lg font-bold text-gray-900">Suggest Opening Hours</h2>
			<button onclick={onclose} aria-label="Close" class="p-1 rounded-md hover:bg-gray-100 text-gray-500">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
			</button>
		</div>

		<div class="space-y-3 mb-4">
			<label class="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all {mode === '24/7' ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}">
				<input type="radio" name="mode" value="24/7" bind:group={mode} class="accent-green-600" />
				<span class="font-medium text-sm">Open 24/7</span>
			</label>

			<label class="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all {mode === 'same-daily' ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}">
				<input type="radio" name="mode" value="same-daily" bind:group={mode} class="accent-green-600" />
				<span class="font-medium text-sm">Same hours every day</span>
			</label>

			<label class="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all {mode === 'custom' ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'}">
				<input type="radio" name="mode" value="custom" bind:group={mode} class="accent-green-600" />
				<span class="font-medium text-sm">Different hours per day</span>
			</label>
		</div>

		{#if mode === 'same-daily'}
			<div class="flex items-center gap-3 mb-4">
				<div class="flex-1">
					<label for="same-open" class="text-xs text-gray-500 mb-1 block">Opens</label>
					<input id="same-open" type="time" bind:value={sameOpen} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-600 focus:border-green-600" />
				</div>
				<span class="text-gray-400 mt-5">–</span>
				<div class="flex-1">
					<label for="same-close" class="text-xs text-gray-500 mb-1 block">Closes</label>
					<input id="same-close" type="time" bind:value={sameClose} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-600 focus:border-green-600" />
				</div>
			</div>
		{/if}

		{#if mode === 'custom'}
			<div class="space-y-2 mb-4">
				{#each [1, 2, 3, 4, 5, 6, 0] as dayIndex}
					<div class="flex items-center gap-2">
						<span class="w-10 text-xs font-medium text-gray-600 shrink-0">{SHORT_DAYS[dayIndex]}</span>
						<input type="time" value={customHours[dayIndex]?.open || '06:00'} onchange={(e) => { if (!customHours[dayIndex]) customHours[dayIndex] = { open: '06:00', close: '22:00' }; customHours[dayIndex].open = (e.target as HTMLInputElement).value; }} class="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-600 focus:border-green-600" />
						<span class="text-gray-400 text-xs">–</span>
						<input type="time" value={customHours[dayIndex]?.close || '22:00'} onchange={(e) => { if (!customHours[dayIndex]) customHours[dayIndex] = { open: '06:00', close: '22:00' }; customHours[dayIndex].close = (e.target as HTMLInputElement).value; }} class="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-green-600 focus:border-green-600" />
					</div>
				{/each}
			</div>
		{/if}

		{#if error}
			<p class="text-sm text-red-600 mb-3">{error}</p>
		{/if}

		<button
			onclick={submit}
			disabled={submitting}
			class="w-full py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm"
		>
			{submitting ? 'Submitting...' : 'Submit Hours'}
		</button>

		<p class="text-xs text-gray-400 text-center mt-2">Suggestions are reviewed before publishing</p>
	</div>
</div>
