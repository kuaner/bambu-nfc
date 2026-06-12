<script lang="ts">
  let { color, secondary = null, size = 'md' }: { color: string; secondary?: string | null; size?: string } = $props()

  const px = $derived(size === 'sm' ? 16 : 20)
  const r = $derived(size === 'sm' ? 3 : 5)
</script>

{#if secondary}
  <span class="flex">
    <span class="shrink-0 border-2 border-border" style="width:{px}px;height:{px}px;border-radius:{r}px 0 0 {r}px;background:{color}"></span>
    <span class="shrink-0 border-2 border-border" style="width:{px}px;height:{px}px;border-radius:0 {r}px {r}px 0;background:{secondary}"></span>
  </span>
{:else}
  <span class="inline-block align-middle shrink-0 border-2 border-border" style="width:{px}px;height:{px}px;border-radius:{r}px;background:{color}"></span>
{/if}
