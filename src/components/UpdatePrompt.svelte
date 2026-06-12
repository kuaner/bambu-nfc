<script lang="ts">
  import { onMount } from 'svelte'
  import { RefreshCw } from '@lucide/svelte'
  import { t } from '../lib/i18n'

  let needUpdate = $state(false)
  let updateSW: (() => Promise<void>) | null = null

  onMount(async () => {
    if ('serviceWorker' in navigator) {
      const { registerSW } = await import('virtual:pwa-register')
      updateSW = registerSW({
        onNeedRefresh() {
          needUpdate = true
        }
      })
    }
  })

  function handleUpdate() {
    updateSW?.()
  }
</script>

{#if needUpdate}
  <div class="fixed bottom-0 left-0 right-0 z-[400] px-4 pb-4 pointer-events-none">
    <div class="max-w-lg mx-auto bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl pointer-events-auto">
      <div class="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
        <RefreshCw size={16} class="text-accent" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold">{t('update.title')}</div>
        <div class="text-xs text-dim">{t('update.desc')}</div>
      </div>
      <button
        class="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors bg-accent text-white hover:bg-accent2"
        onclick={handleUpdate}
      >
        {t('update.button')}
      </button>
    </div>
  </div>
{/if}
