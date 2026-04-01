<script lang="ts">
  let { value, onChange }: { value: number; onChange: (months: number) => void } = $props();
  
  const PRESETS = [
    { label: '1M', value: 1 },
    { label: '3M', value: 3 },
    { label: '6M', value: 6 },
    { label: '1Y', value: 12 },
    { label: 'All', value: -1 }
  ];
</script>

<div class="flex gap-2" role="group" aria-label="Time range selector">
  {#each PRESETS as preset}
    <button
      onclick={() => onChange(preset.value)}
      class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors border {value === preset.value ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
      aria-pressed={value === preset.value}
    >
      {preset.label}
    </button>
  {/each}
</div>
