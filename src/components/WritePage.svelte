<script lang="ts">
  import { bluetooth } from '../stores/bluetooth.svelte'
  import { tagDb } from '../stores/tag-db.svelte'
  import { writeStore } from '../stores/write.svelte'
  import { writeTag } from '../lib/nfc'
  import { t } from '../lib/i18n'
  import { PenLine, Shuffle, Check } from '@lucide/svelte'
  import TagInfoCard from './TagInfoCard.svelte'
  import EmptyState from './EmptyState.svelte'

  let writeError: string | null = $state(null)
  let cardFlash = $state(false)

  const material = $derived(
    tagDb.getMaterial(writeStore.selectedCategory, writeStore.selectedMaterial)
  )

  const colorEntry = $derived(
    writeStore.colors.find(c => c.name === writeStore.selectedColorKey)
  )

  const writePct = $derived(
    writeStore.writeProgress
      ? Math.round(writeStore.writeProgress.current / writeStore.writeProgress.total * 100)
      : 0
  )

  const writeLabel = $derived(
    writeStore.writeProgress?.message ?? t('write.button')
  )

  const writeDone = $derived(
    writeStore.writeProgress != null && !writeStore.isWriting && writeStore.writeProgress.current === writeStore.writeProgress.total
  )

  async function doWrite(): Promise<void> {
    if (writeDone) { writeStore.writeProgress = null; return }
    if (!writeStore.selectedDump || !bluetooth.ultra) return
    writeStore.isWriting = true
    writeError = null

    try {
      const ok = await writeTag(
        bluetooth.ultra,
        writeStore.selectedDump,
        (current, total, message) => {
          writeStore.writeProgress = { current, total, message }
        }
      )
      if (ok) {
        writeStore.writeProgress = { current: 16, total: 16, message: t('write.done') }
      }
    } catch (e: any) {
      writeError = e.message
      writeStore.writeProgress = null
    }
    writeStore.isWriting = false
  }
</script>

<div class="flex flex-col overflow-y-auto px-4 pb-[calc(var(--spacing-tab-h)+var(--spacing-safe-b)+16px)] h-[calc(100dvh-48px-var(--spacing-tab-h)-var(--spacing-safe-b))] bg-bg">

  <!-- 类别：横滑标签 -->
  <div class="mb-2">
    <label class="block text-[0.7rem] font-semibold text-dim mb-1 uppercase tracking-wider bg-none">{t('write.category')}</label>
    <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      {#each tagDb.categories as cat}
        <button
          type="button"
          class="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors border {writeStore.selectedCategory === cat ? 'bg-accent text-white border-accent' : 'bg-card text-dim border-border hover:border-dim'}"
          onclick={() => writeStore.setCategory(cat)}
        >
          {cat}
        </button>
      {/each}
    </div>
  </div>

  <!-- 材料：胶囊按钮 -->
  <div class="mb-2.5">
    <label class="block text-[0.7rem] font-semibold text-dim mb-1 uppercase tracking-wider bg-none">{t('write.material')}</label>
    {#if writeStore.selectedCategory}
      <div class="flex flex-wrap gap-1.5">
        {#each writeStore.materials as mat}
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors border {writeStore.selectedMaterial === mat ? 'bg-accent text-white border-accent' : 'bg-card text-text border-border hover:border-dim'}"
            onclick={() => writeStore.setMaterial(mat)}
          >
            {mat}
          </button>
        {/each}
      </div>
    {:else}
      <div class="text-dim text-sm py-1">{t('write.select')}</div>
    {/if}
  </div>

  <!-- 颜色选择：色块网格 -->
  <div class="mb-2.5">
    <label class="block text-[0.7rem] font-semibold text-dim mb-1 uppercase tracking-wider bg-none">{t('write.color')}</label>
    {#if writeStore.selectedMaterial}
      <div class="flex flex-wrap gap-2">
        {#each writeStore.colors as c}
          <button
            type="button"
            class="w-10 h-10 rounded-lg cursor-pointer transition-all border-2 {c.name === writeStore.selectedColorKey ? 'border-accent scale-110 ring-2 ring-accent/30' : 'border-border hover:border-dim'}"
            style={c.secondaryColorCSS
              ? `background:linear-gradient(135deg, ${c.colorCSS} 50%, ${c.secondaryColorCSS} 50%)`
              : `background:${c.colorCSS}`}
            title={c.name}
            onclick={() => writeStore.selectColor(c.name)}
          >
            {#if c.name === writeStore.selectedColorKey}
              <div class="w-full h-full flex items-center justify-center">
                <Check size={18} class="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" stroke="white" stroke-width={3} />
              </div>
            {/if}
          </button>
        {/each}
      </div>
    {:else}
      <div class="text-dim text-sm py-1.5">{t('write.select_material')}</div>
    {/if}
  </div>

  {#if writeStore.selectedDump && material}
    <TagInfoCard
      title={writeStore.selectedMaterial + ' / ' + (writeStore.selectedColorKey ?? '')}
      color={colorEntry ? { css: colorEntry.colorCSS, secondaryCSS: colorEntry.secondaryColorCSS } : undefined}
      dump={writeStore.selectedDump}
      flash={cardFlash}
    />
  {/if}

  {#if writeStore.isReadyToWrite || writeStore.writeProgress || writeError}
    <div class="flex gap-2 mt-3">
      <button
        class="relative flex items-center justify-center gap-2 px-5 py-3 border-none rounded-[10px] text-sm font-semibold cursor-pointer flex-1 overflow-hidden transition-colors {writeError ? 'bg-red text-white' : writeDone ? 'bg-card text-green border border-green/30' : 'bg-accent text-white disabled:opacity-35 disabled:cursor-not-allowed'}"
        onclick={() => { if (writeError) { writeError = null; return } doWrite() }}
        disabled={!writeDone && !writeError && (writeStore.isWriting || !bluetooth.isConnected)}
      >
        {#if writeStore.writeProgress && !writeDone}
          <div class="absolute inset-0 bg-black/15 transition-[width] duration-300 ease-out" style="width:{writePct}%"></div>
        {/if}
        <span class="relative z-10 flex flex-col items-center gap-0.5">
          {#if writeError}
            <span class="text-xs font-normal">{writeError}</span>
            <span class="text-[0.65rem] opacity-70">{t('write.button')}</span>
          {:else if writeDone}
            <span class="flex items-center gap-1.5"><Check size={16} />{writeLabel}</span>
          {:else}
            {writeLabel}
          {/if}
        </span>
      </button>
      {#if (colorEntry?.dumpCount ?? 0) > 1}
        <button
          class="flex items-center justify-center gap-1.5 px-3 py-3 border border-border rounded-[10px] text-xs font-semibold cursor-pointer transition-colors bg-card text-dim hover:border-accent hover:text-accent shrink-0 disabled:opacity-35 disabled:cursor-not-allowed"
          onclick={() => { writeStore.reshuffleDump(); cardFlash = true; setTimeout(() => cardFlash = false, 450) }}
          disabled={writeStore.isWriting}
        >
          <Shuffle size={14} />
          {t('write.shuffle')}
        </button>
      {/if}
    </div>
  {/if}

  {#if !writeStore.selectedDump}
    <div class="flex-1 flex items-center justify-center">
      <EmptyState icon={PenLine} text={t('write.empty_text')} />
    </div>
  {/if}

  <p class="text-dim text-[0.65rem] text-center mt-auto pt-6 leading-relaxed">{@html t('disclaimer')}</p>
</div>
