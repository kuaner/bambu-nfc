<script lang="ts">
  import ColorSwatch from './ColorSwatch.svelte'
  import { t } from '../lib/i18n'
  import { Check } from '@lucide/svelte'
  import type { TagDump } from '../stores/tag-db.svelte'
  import type { ParsedTag } from '../lib/nfc-parser'

  interface Badge {
    type: 'ok' | 'warn'
    text: string
  }

  let {
    color,
    title,
    badge = null,
    dump = null,
    parsed = null,
    variant = 'write',
    flash = false
  }: {
    color?: { css: string; secondaryCSS?: string | null }
    title: string
    badge?: Badge | null
    dump?: TagDump | null
    parsed?: ParsedTag | null
    variant?: 'scan' | 'write'
    flash?: boolean
  } = $props()

  const d = $derived(dump || parsed)
</script>

<div class="bg-card border border-border rounded-xl p-3.5 mt-3 {flash ? 'animate-card-swap' : ''}">
  <div class="flex items-center gap-2 mb-2.5 font-semibold text-sm {variant === 'scan' ? 'text-base' : ''}">
    <ColorSwatch
      color={color?.css || d?.color?.primary?.css || ''}
      secondary={color?.secondaryCSS || d?.color?.secondary?.css}
    />
    <span>{title}</span>
    {#if badge}
      <span class="inline-flex items-center gap-[3px] px-2 py-[2px] rounded text-[0.65rem] font-semibold {badge.type === 'ok' ? 'bg-green/15 text-green' : 'bg-yellow/15 text-yellow'}">
        <Check size={10} strokeWidth={3} />
        {badge.text}
      </span>
    {/if}
  </div>

  <div class="grid grid-cols-2 gap-y-1.5 gap-x-3.5 text-[0.8rem]">
    <div><span class="text-dim text-[0.68rem]">{t('tag.uid')}</span><br><code class="text-accent text-xs">{d?.uid}</code></div>
    <div><span class="text-dim text-[0.68rem]">{t('tag.weight')}</span><br>{d?.spoolWeight}g</div>

    {#if d?.filamentLength != null}
      <div><span class="text-dim text-[0.68rem]">{t('tag.length')}</span><br>{d.filamentLength}m</div>
    {/if}
    {#if d?.diameter != null}
      <div><span class="text-dim text-[0.68rem]">{t('tag.diameter')}</span><br>{d.diameter}mm</div>
    {/if}
    {#if d?.filamentDiameter != null}
      <div><span class="text-dim text-[0.68rem]">{t('tag.diameter')}</span><br>{d.filamentDiameter}mm</div>
    {/if}

    {#if d?.temps}
      <div><span class="text-dim text-[0.68rem]">{t('tag.hotend')}</span><br>{d.temps.hotendMin}–{d.temps.hotendMax}°C</div>
      <div><span class="text-dim text-[0.68rem]">{t('tag.drying')}</span><br>{d.temps.drying}°C / {d.temps.dryingTime}h</div>
    {/if}
    {#if d?.temperatures}
      <div><span class="text-dim text-[0.68rem]">{t('tag.hotend')}</span><br>{d.temperatures.hotendMin}–{d.temperatures.hotendMax}°C</div>
      <div><span class="text-dim text-[0.68rem]">{t('tag.drying')}</span><br>{d.temperatures.dryingTemp}°C / {d.temperatures.dryingTime}h</div>
    {/if}

    {#if variant === 'scan' && parsed}
      <div><span class="text-dim text-[0.68rem]">{t('tag.nozzle')}</span><br>{parsed.nozzleDiameter}mm</div>
      <div><span class="text-dim text-[0.68rem]">{t('tag.type')}</span><br>{parsed.filamentType}</div>
      <div><span class="text-dim text-[0.68rem]">{t('tag.variant')}</span><br>{parsed.variantId}</div>
      <div><span class="text-dim text-[0.68rem]">{t('tag.material')}</span><br>{parsed.materialId}</div>
      <div><span class="text-dim text-[0.68rem]">{t('tag.date')}</span><br>{parsed.productionDate}</div>
    {/if}

    {#if variant === 'write' && dump?.filamentType}
      <div><span class="text-dim text-[0.68rem]">{t('tag.type')}</span><br>{dump.filamentType}</div>
    {/if}
  </div>
</div>
