<script lang="ts">
  import { writeStore } from './stores/write.svelte'
  import { t } from './lib/i18n'
  import ConnectOverlay from './components/ConnectOverlay.svelte'
  import TopBar from './components/TopBar.svelte'
  import TabBar from './components/TabBar.svelte'
  import ScanPage from './components/ScanPage.svelte'
  import WritePage from './components/WritePage.svelte'

  let activeTab: string = $state('scan')

  function switchTab(tab: string): void {
    activeTab = tab
    writeStore.closeColorDropdown()
  }
</script>

<ConnectOverlay />
<TopBar />

{#if activeTab === 'scan'}
  <ScanPage />
{:else}
  <WritePage />
{/if}

<TabBar {activeTab} ontabchange={switchTab} />
