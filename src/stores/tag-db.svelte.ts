import { dumpProductionSortKey, EXPECTED_DUMP_SIZE, type ParsedTag } from '../lib/nfc-parser'
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
      dumps: sortDumpsNewestFirst(c.dumps)
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

const dumpDateKeyCache = new WeakMap<TagDump, string>()

function dumpDateKey(dump: TagDump): string {
  const cached = dumpDateKeyCache.get(dump)
  if (cached !== undefined) return cached
  let key = ''
  try {
    const bytes = Uint8Array.from(atob(dump.dumpBase64), c => c.charCodeAt(0))
    if (bytes.length === EXPECTED_DUMP_SIZE) key = dumpProductionSortKey(bytes)
  } catch {
    // Corrupt dumpBase64 — treat as undated so it sorts last.
  }
  dumpDateKeyCache.set(dump, key)
  return key
}

const sortedDumpsCache = new WeakMap<TagDump[], TagDump[]>()

/** Same-color dumps, newest production time first. Undated dumps go last. */
export function sortDumpsNewestFirst(dumps: TagDump[]): TagDump[] {
  const cached = sortedDumpsCache.get(dumps)
  if (cached) return cached
  const sorted = [...dumps].sort((a, b) => {
    const ka = dumpDateKey(a)
    const kb = dumpDateKey(b)
    if (ka === kb) return a.uid.localeCompare(b.uid)
    if (!ka) return 1
    if (!kb) return -1
    return kb.localeCompare(ka)
  })
  sortedDumpsCache.set(dumps, sorted)
  return sorted
}
