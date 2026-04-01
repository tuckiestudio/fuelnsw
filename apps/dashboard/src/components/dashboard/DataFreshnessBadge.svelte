<script lang="ts">
  let { lastUpdated }: { lastUpdated: string } = $props();

  function getFreshness(timestamp: string): { color: string; label: string; hours: number } {
    const hours = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60);
    if (hours < 12) return { color: 'bg-green-500', label: 'Updated', hours };
    if (hours < 24) return { color: 'bg-yellow-500', label: 'Stale', hours };
    return { color: 'bg-red-500', label: 'Old', hours };
  }

  let freshness = $derived(getFreshness(lastUpdated));
  let displayTime = $derived(new Date(lastUpdated).toLocaleString('en-AU', { 
    day: 'numeric', 
    month: 'short', 
    hour: '2-digit', 
    minute: '2-digit' 
  }));
</script>

<div class="flex items-center gap-2 text-sm">
  <span class="w-2 h-2 rounded-full {freshness.color} animate-pulse"></span>
  <span class="text-gray-600">
    <span class="font-medium">{freshness.label}</span>: {displayTime}
  </span>
</div>
