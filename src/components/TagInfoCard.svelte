<script lang="ts">
  import ColorSwatch from './ColorSwatch.svelte'
  import { t } from '../lib/i18n'
  import { parseTagDump } from '../lib/nfc-parser'
  import { Thermometer, Wind } from '@lucide/svelte'
  import type { TagDump } from '../stores/tag-db.svelte'
  import type { ParsedTag } from '../lib/nfc-parser'

  let {
    color,
    title,
    dump = null,
    parsed = null,
    flash = false
  }: {
    color?: { css: string; secondaryCSS?: string | null }
    title: string
    dump?: TagDump | null
    parsed?: ParsedTag | null
    flash?: boolean
  } = $props()

  let copied = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  async function copyUid(e: MouseEvent): Promise<void> {
    const uid = dump?.uid ?? parsed?.uid ?? ''
    if (!uid) return
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(uid)
    } catch {
      // Fallback for browsers without async clipboard (HTTPS required).
      const ta = document.createElement('textarea')
      ta.value = uid
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      ta.remove()
    }
    copied = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied = false; copyTimer = null }, 1200)
  }

  const uid = $derived(dump?.uid ?? parsed?.uid ?? '')
  const spoolWeight = $derived(dump?.spoolWeight ?? parsed?.spoolWeight)
  const filamentLength = $derived(dump?.filamentLength ?? parsed?.filamentLength)
  const hotendMin = $derived(dump?.temps?.hotendMin ?? parsed?.temperatures?.hotendMin)
  const hotendMax = $derived(dump?.temps?.hotendMax ?? parsed?.temperatures?.hotendMax)
  const dryingTemp = $derived(dump?.temps?.drying ?? parsed?.temperatures?.dryingTemp)
  const dryingTime = $derived(dump?.temps?.dryingTime ?? parsed?.temperatures?.dryingTime)
  const date = $derived.by(() => {
    if (parsed?.shortProductionDate || parsed?.productionDate)
      return parsed.shortProductionDate || parsed.productionDate
    if (dump?.dumpBase64) {
      const p = parseTagDump(Uint8Array.from(atob(dump.dumpBase64), c => c.charCodeAt(0)))
      if (p?.shortProductionDate || p?.productionDate) return p.shortProductionDate || p.productionDate
    }
    return null
  })
</script>

<div class="bg-card border border-border rounded-xl p-3.5 {flash ? 'animate-card-swap' : ''}">
  <!-- Header -->
  <div class="flex items-center gap-2 mb-3">
    <ColorSwatch
      color={color?.css || parsed?.color?.primary?.css || ''}
      secondary={color?.secondaryCSS || parsed?.color?.secondary?.css}
    />
    <span class="font-semibold text-sm truncate">{title}</span>
  </div>

  <!-- Info chips -->
  <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-dim">
    <span class="inline-flex items-center gap-1">
      UID
      <button
        type="button"
        class="text-accent cursor-pointer hover:underline bg-none border-none p-0 font-inherit"
        onclick={copyUid}
        aria-label="Copy UID"
      >
        <code>{uid}</code>
      </button>
      {#if copied}
        <span class="text-green text-[0.6rem]">{t('tag.uid_copied')}</span>
      {/if}
    </span>
    {#if spoolWeight != null}
      <span>{spoolWeight}g</span>
    {/if}
    {#if filamentLength != null}
      <span>{filamentLength}m</span>
    {/if}
    {#if date}
      <span>{date}</span>
    {/if}
  </div>

  <!-- Temperature row -->
  {#if hotendMin != null || dryingTemp != null}
    <div class="flex items-center gap-4 mt-2 pt-2 border-t border-border/50 text-xs">
      {#if hotendMin != null}
        <span class="flex items-center gap-1.5">
          <Thermometer size={12} class="text-orange" />
          {hotendMin}–{hotendMax}°C
        </span>
      {/if}
      {#if dryingTemp != null}
        <span class="flex items-center gap-1.5">
          <Wind size={12} class="text-yellow" />
          {dryingTemp}°C / {dryingTime}h
        </span>
      {/if}
    </div>
  {/if}
</div>
