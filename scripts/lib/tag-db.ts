import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import type { ParsedTag } from '../../src/lib/nfc-parser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Official Bambu Studio colour database (live source). */
const COLOR_DB_URL =
  'https://raw.githubusercontent.com/bambulab/BambuStudio/master/resources/profiles/BBL/filament/filaments_color_codes.json'
/** Bundled snapshot, refreshed from COLOR_DB_URL on each run when the network is available. */
const COLOR_DB_PATH = path.resolve(__dirname, '..', 'bambu-color-db.json')

/** New-colour dump snapshot extracted from the Android app's shared library. */
const BAMBU_SECTOR_COUNT = 16
const TRAILER_OFFSET = 3 // block 3 of each sector
const ACCESS_BITS: readonly number[] = [0x87, 0x87, 0x87, 0x69]

function isImportableBambuTag(data: Uint8Array): boolean {
  for (let sector = 0; sector < BAMBU_SECTOR_COUNT; sector++) {
    const trailerBlock = (sector * 4 + TRAILER_OFFSET) * 16
    if (trailerBlock + 10 > data.length) return false
    for (let i = 0; i < ACCESS_BITS.length; i++) {
      if (data[trailerBlock + 6 + i] !== ACCESS_BITS[i]) return false
    }
  }
  return true
}

const VALID_CATEGORIES = ['PLA', 'PETG', 'ABS', 'ASA', 'PA', 'PC', 'TPU', 'Support Material']

/**
 * Map a tag's short filament type (block 2, the NFC-internal code) to one of
 * the eight high-level categories. The block-2 code is a vendor shorthand that
 * does not line up 1:1 with the category names, so it needs an explicit table.
 * Tags whose code is absent here fall back to the upstream directory's
 * category via {@link parsePathSegments}.
 */
const FILAMENT_TYPE_TO_CATEGORY: Record<string, string> = {
  PLA: 'PLA',
  'PLA-CF': 'PLA',
  PETG: 'PETG',
  'PETG-CF': 'PETG',
  ABS: 'ABS',
  'ABS-GF': 'ABS',
  ASA: 'ASA',
  'ASA Aero': 'ASA',
  'ASA-CF': 'ASA',
  PC: 'PC',
  'PA-GF': 'PA',
  'PA-CF': 'PA',
  'TPU-AMS': 'TPU',
  // Support codes — both the dedicated shorthands and the generic "Support".
  'PLA-S': 'Support Material',
  'ABS-S': 'Support Material',
  'PA-S': 'Support Material',
  PVA: 'Support Material',
  Support: 'Support Material',
}

/**
 * Map a tag's detailed filament type (block 4) to a category. This is the
 * primary path: block 4 carries the real material name (e.g. "PLA Silk+",
 * "PETG HF") so we can usually classify without touching the directory.
 */
const DETAILED_TYPE_TO_CATEGORY: Record<string, string> = {}
/** Lowercased block-4 string → canonical registered spelling. */
const DETAILED_TYPE_CANONICAL = new Map<string, string>()
function registerDetailedType(detailed: string, category: string): void {
  DETAILED_TYPE_TO_CATEGORY[detailed] = category
  DETAILED_TYPE_CANONICAL.set(detailed.toLowerCase(), detailed)
}

/**
 * Tags occasionally carry a casing variant of a known material (observed:
 * "Support For PLA" on one tag vs "Support for PLA" on the other 57), and
 * keying materials by the raw block-4 string would split them into duplicate
 * groups. Fold anything that differs only by case onto the registered
 * spelling; unknown strings pass through untouched.
 */
function canonicalizeDetailedType(raw: string): string {
  return DETAILED_TYPE_CANONICAL.get(raw.toLowerCase()) ?? raw
}
// The detailed-filament-type namespace is shared with the official colour DB
// (its `fila_type` field), so enumerating the known materials keeps the two
// consistent. Anything unrecognised falls back to the block-2 code or the
// directory layout.
for (const m of [
  'PLA Aero', 'PLA Basic', 'PLA Galaxy', 'PLA Glow', 'PLA Lite', 'PLA Marble',
  'PLA Matte', 'PLA Metal', 'PLA Pure', 'PLA Silk', 'PLA Silk+', 'PLA Sparkle',
  'PLA Tough', 'PLA Tough+', 'PLA Translucent', 'PLA Wood', 'PLA Dynamic',
  'PLA-CF', 'PLA Palette',
]) registerDetailedType(m, 'PLA')
for (const m of ['PETG Basic', 'PETG HF', 'PETG Translucent', 'PETG Matte', 'PETG-CF']) registerDetailedType(m, 'PETG')
for (const m of ['ABS', 'ABS-GF']) registerDetailedType(m, 'ABS')
for (const m of ['ASA', 'ASA Aero', 'ASA-CF']) registerDetailedType(m, 'ASA')
registerDetailedType('PC', 'PC')
registerDetailedType('PC FR', 'PC')
for (const m of ['PA6-GF', 'PA6-CF', 'PAHT-CF', 'PA-CF']) registerDetailedType(m, 'PA')
for (const m of ['TPU for AMS', 'TPU 95A HF', 'TPU 95A', 'TPU 90A', 'TPU 85A']) registerDetailedType(m, 'TPU')
for (const m of [
  'Support for PLA', 'Support for PLA/PETG', 'Support for PA/PET', 'Support for ABS',
  'Support G', 'Support W', 'Support For PA', 'Support for PA', 'PVA',
]) registerDetailedType(m, 'Support Material')

// --- Official colour database ---

interface ColorDBEntry {
  fila_id?: string
  color_code?: string
  fila_type: string
  fila_color_type: string // 单色 / 渐变色 / 多拼色
  fila_color_name: { en?: string; [lang: string]: string | undefined }
  fila_color: string[]
}

function loadColorDB(): { entries: ColorDBEntry[]; refreshed: boolean } {
  let refreshed = false
  try {
    execSync(`curl -sfL ${COLOR_DB_URL} -o ${COLOR_DB_PATH}.tmp`, { stdio: 'ignore' })
    const tmp = JSON.parse(fs.readFileSync(`${COLOR_DB_PATH}.tmp`, 'utf8'))
    // Validate shape before swapping in.
    if (Array.isArray(tmp.data) && tmp.data.length > 0) {
      fs.renameSync(`${COLOR_DB_PATH}.tmp`, COLOR_DB_PATH)
      refreshed = true
    } else {
      fs.rmSync(`${COLOR_DB_PATH}.tmp`, { force: true })
    }
  } catch {
    // Network unavailable in CI/local — fall back to the bundled snapshot.
    fs.rmSync(`${COLOR_DB_PATH}.tmp`, { force: true })
  }
  const raw = JSON.parse(fs.readFileSync(COLOR_DB_PATH, 'utf8'))
  const entries: ColorDBEntry[] = Array.isArray(raw.data) ? raw.data : Array.isArray(raw) ? raw : []
  return { entries, refreshed }
}

/** Strip the alpha channel and uppercase: "#5B6579FF" -> "5B6579". */
function normalizeHex(hex: string): string {
  return hex.replace(/^#/, '').toUpperCase().slice(0, 6)
}

/**
 * The colour signature of a tag as a list of 6-digit RGB hex strings in the
 * order Bambu encodes them (primary first, then secondary). Two tags share a
 * signature iff they carry the same colours, so this is the key used to look
 * up the official name.
 */
function tagColorSignature(tag: ParsedTag): string[] {
  const sig = [normalizeHex(tag.color.primary.hex)]
  if (tag.color.count >= 2 && tag.color.secondary) sig.push(normalizeHex(tag.color.secondary.hex))
  return sig
}

const MULTI_COLOR_TYPES = new Set(['渐变色', '多拼色'])

/**
 * Resolve the official colour name for a tag against the Bambu Studio DB.
 *
 * Strategy (ported from NickWaterton's colordb.lookup_color_name):
 *  1. Exact match — same colour signature AND same material (fila_type ==
 *     detailedFilamentType). This wins outright.
 *  2. Hex-only match in a compatible material — used as a fallback name so an
 *     unrecognised material still gets a sensible colour label.
 * Single-colour tags only consider 单色 entries; multi-colour tags only
 * consider 渐变色 / 多拼色, matching the colour-type filter colordb applies.
 */
function lookupColorName(
  tag: ParsedTag,
  detailedType: string,
  db: ColorDBEntry[],
): { name: string; nameZh: string | null; exact: boolean } | null {
  const sig = tagColorSignature(tag)
  const wantMulti = tag.color.count >= 2
  let hexOnly: { name: string; nameZh: string | null } | null = null

  for (const entry of db) {
    const isMulti = MULTI_COLOR_TYPES.has(entry.fila_color_type)
    if (isMulti !== wantMulti) continue
    const entrySig = entry.fila_color.map(normalizeHex)
    if (entrySig.length !== sig.length) continue
    if (entrySig.some((c, i) => c !== sig[i])) continue
    // Colour signature matches.
    if (entry.fila_type === detailedType && entry.fila_color_name.en) {
      return { name: entry.fila_color_name.en, nameZh: entry.fila_color_name.zh ?? null, exact: true }
    }
    if (!hexOnly && entry.fila_color_name.en) {
      hexOnly = { name: entry.fila_color_name.en, nameZh: entry.fila_color_name.zh ?? null }
    }
  }
  return hexOnly ? { ...hexOnly, exact: false } : null
}


/** "W01" -> "W1", matching the Android app's normalizeBambuColorCode. */
function normalizeColorCode(raw: string): string {
  const cleaned = raw.trim().replace(/[\u0000\u00FF]+$/g, '').toUpperCase()
  if (!cleaned) return ''
  const code = cleaned.split('-').pop()!.trim()
  const match = /^([A-Z]+)(\d+)$/.exec(code)
  if (!match) return code
  return match[1] + (match[2].replace(/^0+/, '') || '0')
}

/**
 * Primary lookup used by the Android app: block 1 carries a material id and a
 * colour code (e.g. GFA00 / A0), and the official DB has the same pair. This
 * resolves colours whose RGB bytes do not exactly match the official entry.
 */
function lookupAppColorName(tag: ParsedTag, db: ColorDBEntry[]): ColorDBEntry | null {
  const filaId = (tag.materialId || '').trim().toUpperCase()
  const code = normalizeColorCode(tag.variantId || '')
  if (!filaId || !code) return null
  for (const entry of db) {
    if ((entry.fila_id || '').trim().toUpperCase() !== filaId) continue
    if (normalizeColorCode(entry.color_code || '') !== code) continue
    return entry
  }
  return null
}

export {
  isImportableBambuTag,
  VALID_CATEGORIES,
  FILAMENT_TYPE_TO_CATEGORY,
  DETAILED_TYPE_TO_CATEGORY,
  canonicalizeDetailedType,
  loadColorDB,
  lookupColorName,
  lookupAppColorName,
  normalizeHex,
  tagColorSignature,
  comboKey,
}
export type { ColorDBEntry }

/** Stable key for a material/colour pair, used to detect duplicates. */
function comboKey(material: string, color: string): string {
  return material + '\u0000' + color
}
