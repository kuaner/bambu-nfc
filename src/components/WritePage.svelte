<script lang="ts">
  import { bluetooth } from '../stores/bluetooth.svelte'
  import { tagDb, colorLabel, sortColorsByHue } from '../stores/tag-db.svelte'
  import { writeStore } from '../stores/write.svelte'
  import { writtenStore } from '../stores/written.svelte'
  import { writeTag, WRITE_PROGRESS_TOTAL, BAMBU_SECTOR_COUNT } from '../lib/nfc'
  import { formatNfcError } from '../lib/nfc-errors'
  import { t } from '../lib/i18n'
  import { PenLine, ChevronRight, Check } from '@lucide/svelte'
  import TagInfoCard from './TagInfoCard.svelte'
  import EmptyState from './EmptyState.svelte'

  let cardFlash = $state(false)

  const material = $derived(
    tagDb.getMaterial(writeStore.selectedCategory, writeStore.selectedMaterial)
  )

  const colorEntry = $derived(
    writeStore.colors.find(c => c.name === writeStore.selectedColorKey)
  )

  const colorMarked = $derived(
    writeStore.selectedColorKey !== null &&
    writtenStore.isWritten(writeStore.selectedCategory, writeStore.selectedMaterial, writeStore.selectedColorKey)
  )

  // Hue-sorted colors for visual grouping
  const sortedColors = $derived(sortColorsByHue(writeStore.colors))

  const writePct = $derived(
    writeStore.writeProgress
      ? Math.round(writeStore.writeProgress.current / writeStore.writeProgress.total * 100)
      : 0
  )

  const writeLabel = $derived.by(() => {
    const p = writeStore.writeProgress
    if (!p) return t('write.button')
    if (p.message) return p.message
    if (p.current === 0) return t('write.progress.format').replace('{0}', '0')
    if (p.current <= BAMBU_SECTOR_COUNT) {
      return t('write.progress.format').replace('{0}', String(p.current))
    }
    if (p.current <= BAMBU_SECTOR_COUNT * 2) {
      return t('write.progress.write').replace('{0}', String(p.current - BAMBU_SECTOR_COUNT))
    }
    return t('write.progress.seal')
  })

  const writeDone = $derived(
    writeStore.writeProgress != null && !writeStore.isWriting &&
    writeStore.writeProgress.current === writeStore.writeProgress.total
  )

  function selectCategory(name: string): void {
    writeStore.setCategory(name)
  }

  function swatchLabel(name: string, nameZh: string | null): string {
    const base = colorLabel(name, nameZh)
    return writtenStore.isWritten(writeStore.selectedCategory, writeStore.selectedMaterial, name)
      ? `${base} · ${t('mark.written')}`
      : base
  }

  function toggleWritten(): void {
    const { selectedCategory, selectedMaterial, selectedColorKey } = writeStore
    if (!selectedCategory || !selectedMaterial || !selectedColorKey) return
    if (writtenStore.isWritten(selectedCategory, selectedMaterial, selectedColorKey)) {
      writtenStore.unmark(selectedCategory, selectedMaterial, selectedColorKey)
    } else {
      writtenStore.mark(selectedCategory, selectedMaterial, selectedColorKey)
    }
  }

  async function doWrite(): Promise<void> {
    if (writeDone) { writeStore.writeProgress = null; return }
    if (!writeStore.selectedDump || !bluetooth.ultra) return
    writeStore.isWriting = true
    writeStore.writeError = null

    try {
      const result = await writeTag(
        bluetooth.ultra,
        writeStore.selectedDump,
        (current, total, message) => {
          writeStore.writeProgress = { current, total, message }
        }
      )
      if (result) {
        const { selectedCategory, selectedMaterial, selectedColorKey, selectedDump } = writeStore
        const colorKey = selectedColorKey ??
          writeStore.colors.find(c => c.dumps.some(d => d.uid === selectedDump?.uid))?.name ??
          null
        if (selectedCategory && selectedMaterial && colorKey) {
          writtenStore.mark(selectedCategory, selectedMaterial, colorKey)
        }
        writeStore.writeProgress = {
          current: WRITE_PROGRESS_TOTAL,
          total: WRITE_PROGRESS_TOTAL,
          message: result.sealed ? t('write.done_ufuid') : t('write.done'),
        }
      }
    } catch (e: any) {
      writeStore.writeError = formatNfcError(e.message)
      writeStore.writeProgress = null
    }
    writeStore.isWriting = false
  }
</script>

<div class="flex flex-col overflow-y-auto px-4 pb-4 h-full bg-bg" role="tabpanel" aria-label="{t('tab.write')}">

  <!-- Category pills -->
  <div class="pt-3 pb-3">
    <label class="block text-[0.7rem] font-semibold text-dim mb-1.5 uppercase tracking-wider bg-none">{t('write.category')}</label>
    <div class="flex flex-wrap gap-1.5">
      {#each tagDb.categories as cat}
        <button
          type="button"
          class="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors border {writeStore.selectedCategory === cat ? 'bg-accent text-white border-accent' : 'bg-card text-dim border-border hover:border-dim'}"
          onclick={() => selectCategory(cat)}
        >
          {cat}
        </button>
      {/each}
    </div>
  </div>

  <!-- Material: expandable section -->
  <div class="pb-3">
    <label class="block text-[0.7rem] font-semibold text-dim mb-1.5 uppercase tracking-wider bg-none">{t('write.material')}</label>
    {#if writeStore.selectedCategory}
      <div class="flex flex-wrap gap-1.5">
        {#each writeStore.materials as mat}
          <button
            type="button"
            class="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors border {writeStore.selectedMaterial === mat ? 'bg-accent text-white border-accent' : 'bg-card text-text border-border hover:border-dim'}"
            onclick={() => writeStore.setMaterial(mat)}
          >
            {mat}
          </button>
        {/each}
      </div>
    {:else}
      <div class="text-dim text-sm py-1">{t('write.select')}</div>
    {/if}
  </div>

  <!-- Color: hue-sorted grid with search -->
  <div class="pb-4">
    <label class="block text-[0.7rem] font-semibold text-dim mb-1.5 uppercase tracking-wider bg-none">{t('write.color')}</label>
    {#if writeStore.selectedMaterial}
      <!-- Color grid -->
      <div class="flex flex-wrap gap-2">
        {#each sortedColors as c (c.name)}
          <button
            type="button"
            aria-pressed={c.name === writeStore.selectedColorKey}
            class="group flex w-16 shrink-0 flex-col items-center gap-1 cursor-pointer bg-transparent border-none p-0"
            aria-label={swatchLabel(c.name, c.nameZh)}
            title={swatchLabel(c.name, c.nameZh)}
            onclick={() => writeStore.selectColor(c.name)}
          >
            <span
              class="relative block h-10 w-10 rounded-lg border-2 transition-all {c.name === writeStore.selectedColorKey ? 'border-accent ring-2 ring-accent/30' : 'border-border group-hover:border-dim'}"
              style={c.secondaryColorCSS
                ? `background:linear-gradient(135deg, ${c.colorCSS} 50%, ${c.secondaryColorCSS} 50%)`
                : `background:${c.colorCSS}`}
            >
              {#if writtenStore.isWritten(writeStore.selectedCategory, writeStore.selectedMaterial, c.name)}
                <span class="absolute -top-1 -right-1 z-10 h-2.5 w-2.5 rounded-full border-2 border-bg bg-green" aria-hidden="true"></span>
              {/if}
              {#if c.name === writeStore.selectedColorKey}
                <span class="absolute inset-0 flex items-center justify-center">
                  <Check size={18} class="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" stroke="white" stroke-width={3} />
                </span>
              {/if}
            </span>
            <span class="w-full text-center text-[0.55rem] leading-[1.2] line-clamp-2 break-words {c.name === writeStore.selectedColorKey ? 'text-text' : 'text-dim'}">{colorLabel(c.name, c.nameZh)}</span>
          </button>
        {/each}
      </div>
    {:else}
      <div class="text-dim text-sm py-1.5">{t('write.select_material')}</div>
    {/if}
  </div>

  {#if writeStore.selectedDump && material}
    <TagInfoCard
      title={writeStore.selectedMaterial + ' / ' + (colorEntry ? colorLabel(colorEntry.name, colorEntry.nameZh) : (writeStore.selectedColorKey ?? ''))}
      color={colorEntry ? { css: colorEntry.colorCSS, secondaryCSS: colorEntry.secondaryColorCSS } : undefined}
      dump={writeStore.selectedDump}
      flash={cardFlash}
    />
  {/if}

  {#if writeStore.isReadyToWrite || writeStore.writeProgress || writeStore.writeError}
    <div class="flex gap-2 mt-4">
      <button
        class="relative flex items-center justify-center gap-2 px-5 py-3 border-none rounded-[10px] text-sm font-semibold cursor-pointer flex-1 overflow-hidden transition-colors {writeStore.writeError ? 'bg-red text-white' : writeDone ? 'bg-card text-green border border-green/30 animate-done-pulse' : 'bg-accent text-white disabled:opacity-35 disabled:cursor-not-allowed'}"
        onclick={() => { if (writeStore.writeError) { writeStore.writeError = null; return } doWrite() }}
        disabled={!writeDone && !writeStore.writeError && (writeStore.isWriting || !bluetooth.isConnected)}
      >
        {#if writeStore.writeProgress && !writeDone}
          <div class="absolute inset-0 bg-black/15 transition-[width] duration-300 ease-out" style="width:{writePct}%"></div>
        {/if}
        <span class="relative z-10 flex flex-col items-center gap-0.5">
          {#if writeStore.writeError}
            <span class="text-xs font-normal">{writeStore.writeError}</span>
            <span class="text-[0.65rem] opacity-70">{t('write.button')}</span>
          {:else if writeDone}
            <span class="flex items-center gap-1.5"><Check size={16} />{writeLabel}</span>
          {:else}
            {writeLabel}
          {/if}
        </span>
      </button>
      {#if colorEntry}
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 px-3 py-3 border rounded-[10px] text-xs font-semibold cursor-pointer transition-colors shrink-0 {colorMarked
            ? 'border-green/30 bg-card text-green hover:border-green/60'
            : 'border-border bg-card text-dim hover:border-accent hover:text-accent'}"
          onclick={toggleWritten}
          title={colorMarked ? t('mark.unmark_written') : t('mark.mark_written')}
        >
          <Check size={14} stroke-width={colorMarked ? 3 : 2} />
          {t(colorMarked ? 'mark.written' : 'mark.mark_written')}
        </button>
      {/if}
      {#if (colorEntry?.dumpCount ?? 0) > 1}
        <button
          class="flex items-center justify-center gap-1.5 px-3 py-3 border border-border rounded-[10px] text-xs font-semibold cursor-pointer transition-colors bg-card text-dim hover:border-accent hover:text-accent shrink-0 disabled:opacity-35 disabled:cursor-not-allowed"
          onclick={() => { writeStore.nextDump(); cardFlash = true; setTimeout(() => cardFlash = false, 450) }}
          disabled={writeStore.isWriting}
        >
          <ChevronRight size={14} />
          {t('write.next')}
        </button>
      {/if}
    </div>
  {/if}

  {#if !writeStore.selectedDump}
    <div class="flex items-center justify-center py-8">
      <EmptyState icon={PenLine} text={t('write.empty_text')} />
    </div>
  {/if}

  <!-- Disclaimer -->
  <p class="text-dim text-[0.65rem] text-center mt-auto pt-6 leading-relaxed">{@html t('disclaimer')}</p>
</div>
