<script lang="ts">
  import { onMount } from 'svelte'
  import { tagDb } from './stores/tag-db.svelte'
  import { writeStore } from './stores/write.svelte'
  import { t } from './lib/i18n'
  import LoadingOverlay from './components/LoadingOverlay.svelte'
  import ConnectOverlay from './components/ConnectOverlay.svelte'
  import TopBar from './components/TopBar.svelte'
  import TabBar from './components/TabBar.svelte'
  import ScanPage from './components/ScanPage.svelte'
  import WritePage from './components/WritePage.svelte'

  let activeTab: string = $state('scan')

  onMount(() => {
    tagDb.load()
  })

  function switchTab(tab: string): void {
    activeTab = tab
    writeStore.closeColorDropdown()
  }
</script>

{#if tagDb.isLoading}
  <LoadingOverlay visible={true} />
{:else if tagDb.loadError}
  <div class="text-red text-center px-5 py-10">
    {t('load_failed')}<br><small>{tagDb.loadError}</small>
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
{/if}
