<script lang="ts">
	let { onclick }: { onclick?: () => void } = $props();
</script>

<button
	onclick={onclick}
	aria-label="My location"
	class="absolute bottom-28 right-3 z-[1000] bg-white hover:bg-gray-50 shadow-lg rounded-full p-3 transition-colors"
>
	<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
</button>
