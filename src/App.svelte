<script lang="ts">
  import { writeStore } from './stores/write.svelte'
  import { t } from './lib/i18n'
  import ConnectOverlay from './components/ConnectOverlay.svelte'
  import TopBar from './components/TopBar.svelte'
  import TabBar from './components/TabBar.svelte'
  import ScanPage from './components/ScanPage.svelte'
  import WritePage from './components/WritePage.svelte'
  import UpdatePrompt from './components/UpdatePrompt.svelte'

  let activeTab: string = $state('scan')

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  function switchTab(tab: string): void {
    activeTab = tab
    writeStore.closeColorDropdown()
  }
</script>

{#if isMobile}
  <div class="flex items-center justify-center min-h-dvh bg-bg px-6">
    <div class="text-center max-w-sm">
      <div class="text-4xl mb-4">📱</div>
      <h2 class="text-lg font-semibold text-text mb-2">{t('unsupported.title')}</h2>
      <p class="text-sm text-dim leading-relaxed">{t('unsupported.desc')}</p>
    </div>
  </div>
{:else}
  <ConnectOverlay />
  <TopBar />

  {#if activeTab === 'scan'}
    <ScanPage />
  {:else}
    <WritePage />
  {/if}

  <TabBar {activeTab} ontabchange={switchTab} />
  <UpdatePrompt />
{/if}

{#if activeTab === 'scan'}
  <ScanPage />
{:else}
  <WritePage />
{/if}

<TabBar {activeTab} ontabchange={switchTab} />
<UpdatePrompt />
