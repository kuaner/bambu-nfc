<script lang="ts">
  import { bluetooth } from '../stores/bluetooth.svelte'
  import { tagDb } from '../stores/tag-db.svelte'
  import { readTag } from '../lib/nfc'
  import { t } from '../lib/i18n'
  import type { ParsedTag } from '../lib/nfc-parser'
  import { BookOpen } from '@lucide/svelte'
  import EmptyState from './EmptyState.svelte'
  import Spinner from './Spinner.svelte'
  import TagInfoCard from './TagInfoCard.svelte'

  type ScanState = 'idle' | 'scanning' | 'result'

  let scanState: ScanState = $state('idle')
  let scanResult: ParsedTag | null = $state(null)
  let matchInfo: string | null = $state(null)

  async function doRead(): Promise<void> {
    if (!bluetooth.ultra) return
    scanState = 'scanning'
    scanResult = null
    matchInfo = null

    const result = await readTag(bluetooth.ultra)
    if (result) {
      scanResult = result.parsed
      matchInfo = tagDb.findInLibrary(result.parsed)
      scanState = 'result'
    } else {
      scanState = 'idle'
    }
  }
</script>

<div class="flex flex-col h-[calc(100dvh-48px-var(--spacing-tab-h)-var(--spacing-safe-b))] bg-bg">
  <!-- Scrollable content -->
  <div class="flex-1 overflow-y-auto px-4">
    {#if scanState === 'idle'}
      <div class="flex flex-col items-center justify-center min-h-full">
        <EmptyState icon={BookOpen} text={t('scan.empty_text')} />
      </div>
    {:else if scanState === 'scanning'}
      <div class="flex flex-col items-center justify-center min-h-full">
        <Spinner />
        <div class="text-dim text-sm mt-4">{t('scan.scanning')}</div>
      </div>
    {:else if scanState === 'result' && scanResult}
      <div class="py-3">
        <TagInfoCard
          title={matchInfo || scanResult.detailedFilamentType || scanResult.filamentType}
          parsed={scanResult}
        />
      </div>
    {/if}
  </div>

  <!-- Fixed bottom button -->
  <div class="shrink-0 px-4 pb-3 pt-1">
    <button
      class="flex items-center justify-center gap-2 px-5 py-3 border-none rounded-[10px] text-sm font-semibold cursor-pointer transition-colors w-full bg-accent text-white hover:bg-accent2 disabled:opacity-35 disabled:cursor-not-allowed"
      onclick={doRead}
      disabled={scanState === 'scanning' || !bluetooth.isConnected}
    >
      {t('scan.button')}
    </button>
  </div>
</div>
