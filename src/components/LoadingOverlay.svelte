<script lang="ts">
  import Spinner from './Spinner.svelte'
  import { t } from '../lib/i18n'
  let { visible = true }: { visible?: boolean } = $props()
</script>

{#if visible}
  <div class="fixed inset-0 bg-bg flex items-center justify-center z-[300] flex-col gap-4">
    <Spinner />
    <div class="text-dim text-sm">{t('loading')}</div>
  </div>
{/if}
