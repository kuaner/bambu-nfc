<script lang="ts">
  import { t } from '../lib/i18n'
  import { Radar, PenLine } from '@lucide/svelte'
  let { activeTab = 'scan', ontabchange }: { activeTab?: string; ontabchange?: (tab: string) => void } = $props()
</script>

<nav class="fixed bottom-0 inset-x-0 h-[calc(var(--spacing-tab-h)+var(--spacing-safe-b))] pb-[var(--spacing-safe-b)] bg-card border-t border-border flex z-[100]" role="tablist" aria-label="Main navigation">
  <button role="tab" aria-selected={activeTab === 'scan'} class="flex-1 flex flex-col items-center justify-center gap-0.5 text-[0.65rem] font-semibold cursor-pointer transition-colors bg-none border-none outline-none p-0 font-inherit {activeTab === 'scan' ? 'text-accent' : 'text-dim'} active:opacity-70" onclick={() => ontabchange?.('scan')}>
    <Radar size={22} />
    {t('tab.scan')}
  </button>
  <button role="tab" aria-selected={activeTab === 'write'} class="flex-1 flex flex-col items-center justify-center gap-0.5 text-[0.65rem] font-semibold cursor-pointer transition-colors bg-none border-none outline-none p-0 font-inherit {activeTab === 'write' ? 'text-accent' : 'text-dim'} active:opacity-70" onclick={() => ontabchange?.('write')}>
    <PenLine size={22} />
    {t('tab.write')}
  </button>
</nav>
