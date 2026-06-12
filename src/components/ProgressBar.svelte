<script lang="ts">
  let { current = 0, total = 1, message = '' }: { current?: number; total?: number; message?: string } = $props()

  const pct = $derived(Math.round(current / total * 100))
  const label = $derived(message || `${current}/${total} (${pct}%)`)
</script>

<div class="bg-bg rounded-md h-1.5 overflow-hidden my-3">
  <div class="h-full bg-accent rounded-md transition-[width] duration-200" style="width:{pct}%"></div>
</div>
<div class="text-[0.72rem] text-dim text-center">{label}</div>
