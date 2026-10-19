<script lang="ts">
  import { bluetooth } from '../stores/bluetooth.svelte'
  import { tagDb, colorLabel, type LibraryMatch } from '../stores/tag-db.svelte'
  import { scanStore, type ScanRecord } from '../stores/scan.svelte'
  import { writeStore } from '../stores/write.svelte'
  import { writtenStore } from '../stores/written.svelte'
  import { readTag } from '../lib/nfc'
  import { formatNfcError } from '../lib/nfc-errors'
  import { t } from '../lib/i18n'
  import type { ParsedTag } from '../lib/nfc-parser'
  import { BookOpen, Check, History, RotateCw, Wrench, X } from '@lucide/svelte'
  import ColorSwatch from './ColorSwatch.svelte'
  import EmptyState from './EmptyState.svelte'
  import TagInfoCard from './TagInfoCard.svelte'

  let { active = true, ontabchange }: { active?: boolean; ontabchange?: (tab: string) => void } = $props()

  type ScanState = 'idle' | 'scanning'

  let scanState: ScanState = $state('idle')
  let scanError: string | null = $state(null)
  let selectedUid: string | null = $state(null)
  let scrollEl: HTMLElement | undefined = $state()

  // 展示中的记录：优先选中项，否则取最新一条；新读卡不再覆盖历史
  const selected = $derived(scanStore.records.find(r => r.uid === selectedUid) ?? scanStore.records[0] ?? null)
  const scanResult: ParsedTag | null = $derived(selected?.parsed ?? null)
  const libraryMatch: LibraryMatch | null = $derived(scanResult ? tagDb.findDumpByUid(scanResult.uid) : null)
  const scanTime = $derived(selected ? selected.time : null)

  const title = $derived.by(() => {
    if (!scanResult) return ''
    if (libraryMatch) return `${libraryMatch.category} / ${libraryMatch.material}`
    return scanResult.detailedFilamentType || scanResult.filamentType
  })

  // 颜色名：UID 命中库时用库内归属，否则按标签颜色字节反查（材料+hex 精确优先，hex 兜底）
  const colorName = $derived.by(() => {
    if (!scanResult) return null
    if (libraryMatch) return colorLabel(libraryMatch.color, libraryMatch.colorZh)
    const found = tagDb.findColorBySignature(scanResult)
    return found ? colorLabel(found.name, found.nameZh) : null
  })

  const history = $derived(scanStore.records.filter(r => r.uid !== selected?.uid))

  function relTime(time: number): string {
    const seconds = Math.floor((Date.now() - time) / 1000)
    if (seconds < 60) return t('scan.just_now')
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return t('scan.minutes_ago').replace('{0}', String(minutes))
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('scan.hours_ago').replace('{0}', String(hours))
    return t('scan.days_ago').replace('{0}', String(Math.floor(hours / 24)))
  }

  function rowColorLabel(record: ScanRecord): string | null {
    const m = tagDb.findDumpByUid(record.uid)
    if (m) return colorLabel(m.color, m.colorZh)
    const c = tagDb.findColorBySignature(record.parsed)
    return c ? colorLabel(c.name, c.nameZh) : null
  }

  async function doRead(): Promise<void> {
    if (!bluetooth.ultra) return
    // If showing an error, clear it and re-read.
    scanError = null
    scanState = 'scanning'
    try {
      const result = await readTag(bluetooth.ultra)
      if (result) {
        scanStore.add(result.parsed)
        selectedUid = result.uid
      } else {
        // No card detected by the scan.
        scanError = t('scan.no_tag')
      }
    } catch (e: any) {
      scanError = formatNfcError(e.message)
    } finally {
      scanState = 'idle'
    }
  }

  function promote(record: ScanRecord): void {
    selectedUid = record.uid
    scrollEl?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function removeRecord(uid: string, e: MouseEvent): void {
    e.stopPropagation()
    scanStore.remove(uid)
    if (uid === selectedUid) selectedUid = null
  }

  function clearHistory(): void {
    scanStore.clear()
    selectedUid = null
  }

  function goRepair(): void {
    if (!libraryMatch) return
    writeStore.selectFromLibrary(
      libraryMatch.category,
      libraryMatch.material,
      libraryMatch.color,
      libraryMatch.dump
    )
    ontabchange?.('write')
  }

  // 读到的卡按 UID 命中库中 dump 时，可一键标记 / 取消该颜色的已写卡记录
  const colorMarked = $derived(
    libraryMatch !== null &&
    writtenStore.isWritten(libraryMatch.category, libraryMatch.material, libraryMatch.color)
  )

  function toggleMarked(): void {
    if (!libraryMatch) return
    const { category, material, color } = libraryMatch
    if (writtenStore.isWritten(category, material, color)) {
      writtenStore.unmark(category, material, color)
    } else {
      writtenStore.mark(category, material, color)
    }
  }
</script>

<div class="flex flex-col h-full bg-bg" role="tabpanel" aria-label="{t('tab.scan')}">
  <!-- Scrollable content -->
  <div class="flex-1 overflow-y-auto px-4" bind:this={scrollEl}>
    {#if !selected}
      <div class="flex flex-col items-center justify-center h-full">
        <EmptyState icon={BookOpen} text={t('scan.empty_text')} />
      </div>
    {:else}
      <div class="py-4">
        {#key `${selected.uid}@${selected.time}`}
          <div class="animate-result-reveal">
            {#if scanTime}
              <div class="flex items-center gap-1.5 text-[0.65rem] text-dim mb-2.5">
                <RotateCw size={10} />
                {relTime(scanTime)}
              </div>
            {/if}
            <TagInfoCard
              {title}
              colorName={colorName}
              parsed={scanResult}
            />
          </div>
        {/key}

        {#if scanStore.records.length > 0}
          <!-- Scan history: newest first, tap a row to view it above -->
          <div class="mt-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5 text-[0.65rem] text-dim font-semibold uppercase tracking-wide">
                <History size={11} />
                {t('scan.history').replace('{0}', String(scanStore.records.length))}
              </div>
              <button
                type="button"
                class="text-[0.65rem] text-dim hover:text-red bg-none border-none p-0 cursor-pointer"
                onclick={clearHistory}
              >
                {t('scan.history_clear')}
              </button>
            </div>
            <div class="flex flex-col gap-1.5">
              {#each history as record (record.uid)}
                {@const rowColor = rowColorLabel(record)}
                <div
                  class="flex items-center gap-2.5 px-3 py-2.5 bg-card border border-border rounded-[10px] cursor-pointer hover:border-accent/50 transition-colors"
                  role="button"
                  tabindex={0}
                  onclick={() => promote(record)}
                  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') promote(record) }}
                >
                  <ColorSwatch
                    size="sm"
                    color={record.parsed.color.primary.css}
                    secondary={record.parsed.color.secondary?.css}
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-semibold truncate">
                      {record.parsed.detailedFilamentType || record.parsed.filamentType}
                      {#if rowColor}
                        <span class="font-normal text-dim"> · {rowColor}</span>
                      {/if}
                    </div>
                    <div class="text-[0.6rem] text-dim mt-0.5"><code>{record.uid}</code> · {relTime(record.time)}</div>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 text-dim hover:text-red bg-none border-none p-1 cursor-pointer"
                    aria-label={t('scan.history_remove')}
                    title={t('scan.history_remove')}
                    onclick={(e) => removeRecord(record.uid, e)}
                  >
                    <X size={13} />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Fixed bottom buttons -->
  <div class="shrink-0 px-4 pb-4 pt-2 flex flex-col gap-2">
    {#if libraryMatch}
      <div class="flex gap-2">
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 px-3 py-3 border rounded-[10px] text-xs font-semibold cursor-pointer transition-colors shrink-0 {colorMarked
            ? 'border-green/30 bg-card text-green hover:border-green/60'
            : 'border-border bg-card text-dim hover:border-accent hover:text-accent'}"
          onclick={toggleMarked}
          title={colorMarked ? t('mark.unmark_written') : t('mark.mark_written')}
        >
          <Check size={14} stroke-width={colorMarked ? 3 : 2} />
          {t(colorMarked ? 'mark.written' : 'mark.mark_written')}
        </button>
        <button
          class="flex items-center justify-center gap-2 px-5 py-3 border border-accent rounded-[10px] text-sm font-semibold cursor-pointer transition-colors flex-1 bg-card text-accent hover:bg-accent/10 disabled:opacity-35 disabled:cursor-not-allowed"
          onclick={goRepair}
          disabled={!bluetooth.isConnected}
        >
          <Wrench size={16} />
          {t('scan.repair')}
        </button>
      </div>
    {/if}
    <button
      class="relative flex items-center justify-center gap-2 px-5 py-3 border-none rounded-[10px] text-sm font-semibold cursor-pointer transition-colors w-full overflow-hidden {scanError ? 'bg-red text-white' : 'bg-accent text-white hover:bg-accent2 disabled:opacity-35 disabled:cursor-not-allowed'}"
      onclick={doRead}
      disabled={scanState === 'scanning' || (!scanError && !bluetooth.isConnected)}
    >
      {#if scanState === 'scanning'}
        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0"></div>
        <span>{t('scan.scanning')}</span>
      {:else if scanError}
        <span class="truncate text-xs font-normal" title={scanError}>{scanError}</span>
      {:else}
        {selected ? t('scan.button_again') : t('scan.button')}
      {/if}
    </button>
  </div>
</div>
