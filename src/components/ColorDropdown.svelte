<script lang="ts">
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

  let popoverEl: HTMLDivElement
  let triggerEl: HTMLButtonElement

  function toggle(): void {
    if (popoverEl) {
      popoverEl.togglePopover()
    }
    ontoggle?.()
  }

  function handleSelect(name: string): void {
    onselect?.(name)
    popoverEl?.hidePopover()
  }

  function onBeforeToggle(e: ToggleEvent): void {
    if (e.newState === 'closed') onclose?.()
  }
</script>

<div class="relative">
  <button
    type="button"
    bind:this={triggerEl}
    class="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text text-sm cursor-pointer flex items-center gap-2 text-left font-inherit hover:border-accent transition-colors"
    aria-haspopup="listbox"
    aria-expanded={open}
    onclick={toggle}
  >
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

  <div
    bind:this={popoverEl}
    popover="auto"
    onbeforetoggle={onBeforeToggle}
    class="bg-card border border-border rounded-lg max-h-60 overflow-y-auto z-50 m-0 p-0 w-[var(--_dropdown-width)]"
    style="box-shadow: var(--shadow-dropdown)"
    role="listbox"
    aria-label="Select color"
    style="--_dropdown-width: {triggerEl ? `${triggerEl.offsetWidth}px` : '100%'}"
  >
    {#each colors as c}
      <button
        type="button"
        role="option"
        aria-selected={c.name === selected}
        class="flex items-center gap-2.5 px-3 py-[9px] cursor-pointer text-[0.82rem] transition-colors bg-none border-none w-full text-left text-text font-inherit {c.name === selected ? 'bg-accent/15' : 'hover:bg-accent/10'}"
        onclick={() => handleSelect(c.name)}
      >
        <ColorSwatch color={c.colorCSS} secondary={c.secondaryColorCSS} size="sm" />
        <span class="flex-1">{c.name}</span>
        <span class="text-dim text-[0.72rem]">{c.dumpCount}</span>
      </button>
    {/each}
  </div>
</div>
