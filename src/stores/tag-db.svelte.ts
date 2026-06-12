import type { ParsedTag } from '../lib/nfc-parser'

interface TagDB {
  generated: string
  totalDumps: number
  categories: Record<string, {
    materials: Record<string, {
      displayName: string
      filamentType: string
      colors: Record<string, {
        displayName: string
        colorCSS: string
        colorHex: string
        secondaryColorCSS: string | null
        dumps: TagDump[]
      }>
    }>
  }>
}

export interface TagDump {
  uid: string
  spoolWeight: number
  filamentLength: number
  diameter: number
  nozzleDiameter: number
  temps: {
    drying: number
    dryingTime: number
    bed: number
    hotendMin: number
    hotendMax: number
  }
  dumpBase64: string
}

export interface ColorEntry {
  name: string
  colorCSS: string
  secondaryColorCSS: string | null
  dumpCount: number
  dumps: TagDump[]
}

class TagDbStore {
  tagDB = $state<TagDB | null>(null)
  isLoading = $state(true)
  loadError = $state<string | null>(null)

  get categories(): string[] {
    return this.tagDB ? Object.keys(this.tagDB.categories) : []
  }

  get isReady(): boolean {
    return this.tagDB !== null
  }

  async load(): Promise<void> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30_000)
      const resp = await fetch(import.meta.env.BASE_URL + 'bambu-tags.json', { signal: controller.signal })
      clearTimeout(timeout)
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      this.tagDB = await resp.json()
    } catch (e: any) {
      this.loadError = e.name === 'AbortError' ? 'Timeout' : e.message
    }
    this.isLoading = false
  }

  getMaterials(categoryName: string): string[] {
    if (!this.tagDB?.categories[categoryName]) return []
    return Object.keys(this.tagDB.categories[categoryName].materials)
  }

  getMaterial(categoryName: string, materialName: string) {
    return this.tagDB?.categories[categoryName]?.materials[materialName] ?? null
  }

  getColors(categoryName: string, materialName: string): ColorEntry[] {
    const mat = this.getMaterial(categoryName, materialName)
    if (!mat) return []
    return Object.entries(mat.colors).map(([name, c]) => ({
      name,
      colorCSS: c.colorCSS,
      secondaryColorCSS: c.secondaryColorCSS,
      dumpCount: c.dumps.length,
      dumps: c.dumps
    }))
  }

  findInLibrary(parsed: ParsedTag): string | null {
    if (!this.tagDB) return null
    for (const c in this.tagDB.categories) {
      for (const m in this.tagDB.categories[c].materials) {
        const mat = this.tagDB.categories[c].materials[m]
        if (mat.filamentType === parsed.filamentType) {
          for (const col in mat.colors) {
            for (const dump of mat.colors[col].dumps) {
              if (dump.uid === parsed.uid) return `${c} / ${m} / ${col}`
            }
          }
        }
      }
    }
    for (const c in this.tagDB.categories) {
      for (const m in this.tagDB.categories[c].materials) {
        if (m === parsed.detailedFilamentType) return `${c} / ${m}`
      }
    }
    return null
  }
}

export const tagDb = new TagDbStore()
