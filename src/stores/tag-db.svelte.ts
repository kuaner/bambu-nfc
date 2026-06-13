import type { ParsedTag } from '../lib/nfc-parser'
import tagData from '../data/bambu-tags.json'

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

export interface LibraryMatch {
  category: string
  material: string
  color: string
  dump: TagDump
}

export interface ColorEntry {
  name: string
  colorCSS: string
  secondaryColorCSS: string | null
  dumpCount: number
  dumps: TagDump[]
}

const tagDB = tagData as TagDB

class TagDbStore {
  get categories(): string[] {
    return Object.keys(tagDB.categories)
  }

  get isReady(): boolean {
    return true
  }

  getMaterials(categoryName: string): string[] {
    if (!tagDB.categories[categoryName]) return []
    return Object.keys(tagDB.categories[categoryName].materials)
  }

  getMaterial(categoryName: string, materialName: string) {
    return tagDB.categories[categoryName]?.materials[materialName] ?? null
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

  findInLibrary(parsed: ParsedTag, uid?: string): string | null {
    const uidMatch = this.findDumpByUid(uid ?? parsed.uid)
    if (uidMatch) {
      return `${uidMatch.category} / ${uidMatch.material} / ${uidMatch.color}`
    }
    for (const c in tagDB.categories) {
      for (const m in tagDB.categories[c].materials) {
        if (m === parsed.detailedFilamentType) return `${c} / ${m}`
      }
    }
    return null
  }

  findDumpByUid(uid: string): LibraryMatch | null {
    const normalized = uid.toUpperCase()
    for (const category in tagDB.categories) {
      for (const material in tagDB.categories[category].materials) {
        const mat = tagDB.categories[category].materials[material]
        for (const color in mat.colors) {
          for (const dump of mat.colors[color].dumps) {
            if (dump.uid.toUpperCase() === normalized) {
              return { category, material, color, dump }
            }
          }
        }
      }
    }
    return null
  }
}

export const tagDb = new TagDbStore()
