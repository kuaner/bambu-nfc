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
        displayNameZh: string | null
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
  colorZh: string | null
  dump: TagDump
}

export interface ColorEntry {
  name: string
  nameZh: string | null
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
      nameZh: c.displayNameZh,
      colorCSS: c.colorCSS,
      secondaryColorCSS: c.secondaryColorCSS,
      dumpCount: c.dumps.length,
      dumps: c.dumps
    }))
  }

  findInLibrary(parsed: ParsedTag, uid?: string): string | null {
    const uidMatch = this.findDumpByUid(uid ?? parsed.uid)
    if (uidMatch) {
      return `${uidMatch.category} / ${uidMatch.material} / ${colorLabel(uidMatch.color, uidMatch.colorZh)}`
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
              return { category, material, color, colorZh: mat.colors[color].displayNameZh, dump }
            }
          }
        }
      }
    }
    return null
  }
}

export const tagDb = new TagDbStore()

/**
 * Render a colour name showing both Chinese and English when both are
 * available, e.g. "蓝灰 / Blue Gray". Falls back to the English name alone
 * when no official Chinese name was resolved.
 */
export function colorLabel(name: string, nameZh: string | null | undefined): string {
  return nameZh ? `${nameZh} / ${name}` : name
}
