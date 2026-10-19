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

  #uidCache = new Map<string, LibraryMatch | null>()

  findDumpByUid(uid: string): LibraryMatch | null {
    const normalized = uid.toUpperCase()
    if (this.#uidCache.has(normalized)) return this.#uidCache.get(normalized)!
    let match: LibraryMatch | null = null
    for (const category in tagDB.categories) {
      for (const material in tagDB.categories[category].materials) {
        const mat = tagDB.categories[category].materials[material]
        for (const color in mat.colors) {
          for (const dump of mat.colors[color].dumps) {
            if (dump.uid.toUpperCase() === normalized) {
              match = { category, material, color, colorZh: mat.colors[color].displayNameZh, dump }
              break
            }
          }
          if (match) break
        }
        if (match) break
      }
      if (match) break
    }
    this.#uidCache.set(normalized, match)
    return match
  }

  /**
   * Resolve a colour label for a scanned tag from its own colour bytes — the
   * same data-driven lookup the DB build performs: exact (material + colour
   * signature) match first, hex-only match across the library as fallback.
   * Covers tags whose UID is not in the library (custom / newer dumps).
   */
  findColorBySignature(parsed: ParsedTag): { name: string; nameZh: string | null } | null {
    const sig = [hex6(parsed.color.primary.hex)]
    if (parsed.color.count >= 2 && parsed.color.secondary) sig.push(hex6(parsed.color.secondary.hex))
    if (!sig[0]) return null
    const detailed = parsed.detailedFilamentType.toLowerCase()
    let hexOnly: { name: string; nameZh: string | null } | null = null
    for (const category in tagDB.categories) {
      for (const material in tagDB.categories[category].materials) {
        const mat = tagDB.categories[category].materials[material]
        for (const color in mat.colors) {
          const entry = mat.colors[color]
          const entrySig = [hex6(entry.colorHex)]
          if (entry.secondaryColorCSS) entrySig.push(hex6(entry.secondaryColorCSS))
          if (entrySig.length !== sig.length) continue
          if (entrySig.some((h, i) => h !== sig[i])) continue
          if (material.toLowerCase() === detailed) return { name: color, nameZh: entry.displayNameZh }
          if (!hexOnly) hexOnly = { name: color, nameZh: entry.displayNameZh }
        }
      }
    }
    return hexOnly
  }
}

/** "#5b6579ff" / "#5B6579" → "5B6579" — colour bytes may carry an alpha channel. */
function hex6(hex: string): string {
  return hex.replace(/^#/, '').toUpperCase().slice(0, 6)
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

function cssHue(css: string): number {
  const hex = css.startsWith('#') ? css : '#000000'
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0))
  else if (max === g) h = ((b - r) / d + 2)
  else h = ((r - g) / d + 4)
  return h * 60
}

function hueGroup(hue: number, css: string): number {
  const hex = css.startsWith('#') ? css : '#000000'
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max - min < 25) return 6 // neutral/gray
  if (hue < 30 || hue >= 330) return 0 // reds/pinks
  if (hue < 70) return 1 // oranges/yellows
  if (hue < 170) return 2 // greens
  if (hue < 270) return 3 // blues
  return 4 // purples
}

const hueSortedCache = new WeakMap<ColorEntry[], ColorEntry[]>()

/** Swatches grouped by hue family (reds → … → purples, neutrals last). */
export function sortColorsByHue(colors: ColorEntry[]): ColorEntry[] {
  const cached = hueSortedCache.get(colors)
  if (cached) return cached
  const decorated = colors.map(c => {
    const hue = cssHue(c.colorCSS)
    return { entry: c, hue, group: hueGroup(hue, c.colorCSS) }
  })
  decorated.sort((a, b) => (a.group !== b.group ? a.group - b.group : a.hue - b.hue))
  const sorted = decorated.map(d => d.entry)
  hueSortedCache.set(colors, sorted)
  return sorted
}
