<script lang="ts">
  import { onMount } from 'svelte'
  import ColorSwatch from './ColorSwatch.svelte'
  import { t } from '../lib/i18n'
  import { ChevronDown } from '@lucide/svelte'
  import type { ColorEntry } from '../stores/tag-db.svelte'

  let {
    colors = [],
    selected = null,
    open = false,
    onselect,
    ontoggle,
    onclose
  }: {
    colors?: ColorEntry[]
    selected?: string | null
    open?: boolean
    onselect?: (name: string) => void
    ontoggle?: () => void
    onclose?: () => void
  } = $props()

  let wrapEl: HTMLDivElement

  onMount(() => {
    const handler = (e: MouseEvent) => {
      if (wrapEl && !wrapEl.contains(e.target as Node)) onclose?.()
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  })
</script>

<div class="relative" bind:this={wrapEl}>
  <button type="button" class="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text text-sm cursor-pointer flex items-center gap-2 text-left outline-none font-inherit hover:border-accent transition-colors" onclick={() => ontoggle?.()}>
    {#if selected}
      {@const c = colors.find(c => c.name === selected)}
      {#if c}
        <ColorSwatch color={c.colorCSS} secondary={c.secondaryColorCSS} size="sm" />
      {/if}
      <span class="flex-1">{selected}</span>
    {:else}
      <span class="flex-1">{t('write.select')}</span>
    {/if}
    <ChevronDown size={12} class="text-dim shrink-0" />
  </button>

  <div class="absolute top-[calc(100%+4px)] inset-x-0 bg-card border border-border rounded-lg max-h-60 overflow-y-auto z-50 shadow-[0_8px_24px_rgba(0,0,0,0.5)] {open ? 'block' : 'hidden'}">
    {#each colors as c}
      <button
        type="button"
        class="flex items-center gap-2.5 px-3 py-[9px] cursor-pointer text-[0.82rem] transition-colors bg-none border-none outline-none w-full text-left text-text font-inherit {c.name === selected ? 'bg-accent/15' : 'hover:bg-accent/10'}"
        onclick={() => onselect?.(c.name)}
      >
        <ColorSwatch color={c.colorCSS} secondary={c.secondaryColorCSS} size="sm" />
        <span class="flex-1">{c.name}</span>
        <span class="text-dim text-[0.72rem]">{c.dumpCount}</span>
      </button>
    {/each}
  </div>
</div>
