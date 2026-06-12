<script lang="ts">
  import { bluetooth } from '../stores/bluetooth.svelte'
  import { i18n, t } from '../lib/i18n'
  import { X } from '@lucide/svelte'
</script>

<div class="h-12 flex items-center justify-between px-4 bg-bg border-b border-border relative z-10">
  <div class="text-[1.05rem] font-bold">Bambu <span class="text-accent">NFC</span></div>
  <div class="flex items-center gap-2">
    {#if bluetooth.isConnected}
      <button class="flex items-center gap-1.5 text-xs text-dim bg-none border border-border rounded-md px-2.5 py-1 cursor-pointer transition-colors hover:border-red group" onclick={() => bluetooth.disconnect()}>
        <div class="w-[7px] h-[7px] rounded-full bg-green shrink-0"></div>
        <span>{t('conn.connected')}</span>
        <X size={14} class="text-dim group-hover:text-red transition-colors" />
      </button>
    {:else}
      <div class="flex items-center gap-1.5 text-xs text-dim">
        <div class="w-[7px] h-[7px] rounded-full bg-red shrink-0"></div>
        <span>{t('conn.not_connected')}</span>
      </div>
    {/if}
    <button class="bg-none border border-border rounded text-dim text-[0.65rem] font-bold px-1.5 py-[3px] cursor-pointer transition-colors hover:border-accent hover:text-accent" onclick={() => i18n.toggle()}>
      {i18n.locale === 'en' ? '中' : 'EN'}
    </button>
  </div>
</div>
