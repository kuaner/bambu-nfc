<script lang="ts">
  import { bluetooth } from '../stores/bluetooth.svelte'
  import { t } from '../lib/i18n'
  import { Bluetooth } from '@lucide/svelte'
</script>

{#if !bluetooth.isConnected}
  <div class="fixed inset-0 bg-bg/95 flex flex-col items-center justify-center z-[200] gap-5">
    <div class="text-[2.5rem] font-extrabold">Bambu <span class="text-accent">NFC</span></div>
    <div class="text-dim text-sm text-center max-w-[260px]">{t('conn.subtitle')}</div>
    <button
      class="flex items-center justify-center gap-2 px-5 py-3 border-none rounded-[10px] text-sm font-semibold cursor-pointer transition-colors w-full max-w-60 bg-accent text-white hover:bg-accent2 disabled:opacity-35 disabled:cursor-not-allowed"
      onclick={() => bluetooth.connect()}
      disabled={bluetooth.isConnecting}
    >
      <Bluetooth size={18} />
      {bluetooth.isConnecting ? t('conn.connecting') : t('conn.button')}
    </button>
    {#if bluetooth.error}
      <div class="text-red text-xs">{t('conn.failed')}{bluetooth.error}</div>
    {/if}
    {#if import.meta.env.DEV}
      <button class="bg-none border border-dashed border-border rounded-md text-dim text-[0.7rem] px-4 py-1.5 cursor-pointer mt-6 transition-colors hover:border-accent hover:text-accent" onclick={() => bluetooth.connectDebug()}>Skip (Debug)</button>
    {/if}
  </div>
{/if}
