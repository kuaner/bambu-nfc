<script lang="ts">
  import { bluetooth } from '../stores/bluetooth.svelte'
  import { tagDb } from '../stores/tag-db.svelte'
  import { readTag } from '../lib/nfc'
  import { t } from '../lib/i18n'
  import type { ParsedTag } from '../lib/nfc-parser'
  import { BookOpen, RotateCw } from '@lucide/svelte'
  import EmptyState from './EmptyState.svelte'
  import Spinner from './Spinner.svelte'
  import TagInfoCard from './TagInfoCard.svelte'

  let { active = true }: { active?: boolean } = $props()

  type ScanState = 'idle' | 'scanning' | 'result'

  let scanState: ScanState = $state('idle')
  let scanResult: ParsedTag | null = $state(null)
  let matchInfo: string | null = $state(null)
  let scanTime: Date | null = $state(null)

  const scanAge = $derived.by(() => {
    if (!scanTime) return null
    const seconds = Math.floor((Date.now() - scanTime.getTime()) / 1000)
    if (seconds < 60) return t('scan.just_now')
    const minutes = Math.floor(seconds / 60)
    return t('scan.minutes_ago').replace('{0}', String(minutes))
  })

  async function doRead(): Promise<void> {
    if (!bluetooth.ultra) return
    scanState = 'scanning'
    scanResult = null
    matchInfo = null

    const result = await readTag(bluetooth.ultra)
    if (result) {
      scanResult = result.parsed
      matchInfo = tagDb.findInLibrary(result.parsed)
      scanTime = new Date()
      scanState = 'result'
    } else {
      scanState = 'idle'
    }
  }
</script>

<div class="flex flex-col h-full bg-bg" role="tabpanel" aria-label="{t('tab.scan')}">
  <!-- Scrollable content -->
  <div class="flex-1 overflow-y-auto px-4">
    {#if scanState === 'idle' && !scanResult}
      <div class="flex flex-col items-center justify-center h-full">
        <EmptyState icon={BookOpen} text={t('scan.empty_text')} />
      </div>
    {:else if scanState === 'scanning'}
      <div class="flex flex-col items-center justify-center h-full">
        <Spinner />
        <div class="text-dim text-sm mt-4">{t('scan.scanning')}</div>
      </div>
    {:else if scanResult}
      <div class="py-4 animate-result-reveal">
        {#if scanAge}
          <div class="flex items-center gap-1.5 text-[0.65rem] text-dim mb-2.5">
            <RotateCw size={10} />
            {scanAge}
          </div>
        {/if}
        <TagInfoCard
          title={matchInfo || scanResult.detailedFilamentType || scanResult.filamentType}
          parsed={scanResult}
        />
      </div>
    {/if}
  </div>

  <!-- Fixed bottom button -->
  <div class="shrink-0 px-4 pb-4 pt-2">
    <button
      class="flex items-center justify-center gap-2 px-5 py-3 border-none rounded-[10px] text-sm font-semibold cursor-pointer transition-colors w-full bg-accent text-white hover:bg-accent2 disabled:opacity-35 disabled:cursor-not-allowed"
      onclick={doRead}
      disabled={scanState === 'scanning' || !bluetooth.isConnected}
    >
      {scanState === 'result' ? t('scan.button_again') : t('scan.button')}
    </button>
  </div>
</div>
