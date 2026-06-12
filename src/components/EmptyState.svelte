<script lang="ts">
  import type { Component } from 'svelte'
  let { icon: Icon, text }: { icon: Component; text: string } = $props()
</script>

<div class="flex flex-col items-center px-5 py-12 text-dim text-sm">
  <div class="mb-3 opacity-30">
    <Icon size={48} stroke-width={1.5} />
  </div>
  <div class="text-center">{@html text}</div>
</div>
