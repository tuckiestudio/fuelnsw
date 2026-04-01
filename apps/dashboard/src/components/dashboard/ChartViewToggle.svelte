<script lang="ts">
  let { value, onChange }: { value: 'bar' | 'line'; onChange: (view: 'bar' | 'line') => void } = $props();
</script>

<div class="flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="Chart view toggle">
  <button
    onclick={() => onChange('bar')}
    class="px-3 py-1.5 text-sm font-medium transition-colors {value === 'bar' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}"
    aria-pressed={value === 'bar'}
  >
    Bar
  </button>
  <button
    onclick={() => onChange('line')}
    class="px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 {value === 'line' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}"
    aria-pressed={value === 'line'}
  >
    Line
  </button>
</div>
