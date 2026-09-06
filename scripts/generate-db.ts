#!/usr/bin/env node
/**
 * Scan the Bambu-Lab-RFID-Library and generate a JSON database
 * of all available NFC tag dumps for the web writer tool.
 *
 * Classification is driven by the tag's own data, not the upstream
 * directory layout: the material comes from block 4 (detailed filament
 * type) and the colour name is resolved against Bambu Studio's official
 * filament colour database (BambuLab/BambuStudio → filaments_color_codes.json)
 * using the colour bytes encoded on the tag. This mirrors the correction
 * logic NickWaterton applies with fix_library.py / colordb.py, but runs it
 * at build time so the emitted database stays aligned with official Bambu
 * naming without depending on a cleaned upstream fork.
 *
 * Usage: node scripts/generate-db.js [library-path] [output-path]
 *   library-path: path to bambu-rfid-library (default: ./bambu-rfid-library)
 *   output-path:  path to output JSON file (default: ./src/data/bambu-tags.json)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { parseTagDump, dumpProductionSortKey, EXPECTED_DUMP_SIZE, type ParsedTag } from '../src/lib/nfc-parser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const REPO_URL = 'https://github.com/queengooborg/Bambu-Lab-RFID-Library.git'
const LIBRARY_DIR = process.argv[2] || path.join(ROOT, 'bambu-rfid-library')
const OUTPUT_FILE = process.argv[3] || path.join(ROOT, 'src', 'data', 'bambu-tags.json')
const shouldCleanup = !process.argv[2]

/** Official Bambu Studio colour database (live source). */
const COLOR_DB_URL =
  'https://raw.githubusercontent.com/bambulab/BambuStudio/master/resources/profiles/BBL/filament/filaments_color_codes.json'
/** Bundled snapshot, refreshed from COLOR_DB_URL on each run when the network is available. */
const COLOR_DB_PATH = path.join(__dirname, 'bambu-color-db.json')

// --- Directory scanning ---

function walkDir(dir: string): string[] {
  let results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath))
    } else if (entry.isFile()) {
      results.push(fullPath)
    }
  }
  return results
}

function isDumpFile(filePath: string): boolean {
  const base = path.basename(filePath)
  if (base.endsWith('-key.bin')) return false
  if (!base.endsWith('.bin')) return false
  return true
}

/**
 * Check whether a dump has the Bambu sector-trailer layout.
 *
 * Every sector's trailer (block `sector*4 + 3`) must carry the fixed access
 * bits + user byte `87 87 87 69` at offset 6..9. The import app rejects any
 * card where a single sector fails this check (counts it as `invalid`), so we
 * filter such dumps out here to keep the database import-compatible.
 *
 * Key A/B are deliberately not checked: third-party readers report Key A as
 * all-zero due to Mifare Classic hardware masking, so only the access bits are
 * a reliable "this is a Bambu sector" signal.
 */
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
function registerDetailedType(detailed: string, category: string): void {
  DETAILED_TYPE_TO_CATEGORY[detailed] = category
}
// The detailed-filament-type namespace is shared with the official colour DB
// (its `fila_type` field), so enumerating the known materials keeps the two
// consistent. Anything unrecognised falls back to the block-2 code or the
// directory layout.
for (const m of [
  'PLA Aero', 'PLA Basic', 'PLA Galaxy', 'PLA Glow', 'PLA Lite', 'PLA Marble',
  'PLA Matte', 'PLA Metal', 'PLA Pure', 'PLA Silk', 'PLA Silk+', 'PLA Sparkle',
  'PLA Tough', 'PLA Tough+', 'PLA Translucent', 'PLA Wood', 'PLA Dynamic',
  'PLA-CF',
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
  'Support G', 'Support W', 'Support For PA', 'PVA',
]) registerDetailedType(m, 'Support Material')

// --- Official colour database ---

interface ColorDBEntry {
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
    if (entry.fila_type === tag.detailedFilamentType && entry.fila_color_name.en) {
      return { name: entry.fila_color_name.en, nameZh: entry.fila_color_name.zh ?? null, exact: true }
    }
    if (!hexOnly && entry.fila_color_name.en) {
      hexOnly = { name: entry.fila_color_name.en, nameZh: entry.fila_color_name.zh ?? null }
    }
  }
  return hexOnly ? { ...hexOnly, exact: false } : null
}

// --- Path fallback ---

/**
 * Extract the upstream directory triplet as a last-resort classification. With
 * data-driven classification now in place this only fills in category /
 * material / colour when a tag's own fields are ambiguous.
 */
function parsePathSegments(filePath: string): { category: string; material: string; color: string } | null {
  const parts = filePath.split(path.sep)
  const len = parts.length
  if (len < 5) return null
  const category = parts[len - 5]
  const material = parts[len - 4]
  const color = parts[len - 3]
  if (!VALID_CATEGORIES.includes(category)) return null
  return { category, material, color }
}

// --- Main ---

function main(): void {
  if (!fs.existsSync(LIBRARY_DIR)) {
    console.log('Cloning RFID library (shallow)...')
    execSync(`git clone --depth 1 ${REPO_URL} ${LIBRARY_DIR}`, { stdio: 'inherit' })
  }

  console.log('Scanning library at: ' + LIBRARY_DIR)

  const { entries: colorDB, refreshed } = loadColorDB()
  console.log(
    `Colour DB: ${colorDB.length} entries (${refreshed ? 'refreshed from BambuStudio' : 'using bundled snapshot'})`,
  )

  const allFiles = walkDir(LIBRARY_DIR)
  const binFiles = allFiles.filter(isDumpFile)
  console.log('Found ' + binFiles.length + ' .bin dump files')

  const categories: Record<string, any> = {}
  let totalDumps = 0
  let skipped = 0
  let invalidTrailers = 0
  let renamed = 0
  let reclassified = 0
  const errors: { file: string; error: string }[] = []

  for (const filePath of binFiles) {
    try {
      const data = fs.readFileSync(filePath)
      if (data.length !== EXPECTED_DUMP_SIZE) { skipped++; continue }

      const bytes = new Uint8Array(data)
      if (!isImportableBambuTag(bytes)) { invalidTrailers++; continue }

      const tag = parseTagDump(bytes)
      if (!tag) { skipped++; continue }

      const pathInfo = parsePathSegments(filePath)

      // Resolve category: detailed type → short type → directory.
      let category =
        DETAILED_TYPE_TO_CATEGORY[tag.detailedFilamentType] ??
        FILAMENT_TYPE_TO_CATEGORY[tag.filamentType] ??
        pathInfo?.category ??
        null
      // Resolve material: detailed type → directory.
      let material = tag.detailedFilamentType || pathInfo?.material || null
      // Resolve colour: official DB → directory.
      const official = lookupColorName(tag, colorDB)
      let color = official?.name ?? pathInfo?.color ?? null

      if (!category || !material || !color) { skipped++; continue }
      if (!VALID_CATEGORIES.includes(category)) { skipped++; continue }

      // Telemetry: how much did data-driven classification move things?
      if (pathInfo && (pathInfo.category !== category || pathInfo.material !== material)) reclassified++
      if (pathInfo && pathInfo.color !== color) renamed++

      if (!categories[category]) categories[category] = { materials: {} }
      if (!categories[category].materials[material]) {
        categories[category].materials[material] = {
          displayName: material,
          filamentType: tag.filamentType,
          colors: {},
        }
      }
      if (!categories[category].materials[material].colors[color]) {
        categories[category].materials[material].colors[color] = {
          displayName: color,
          displayNameZh: official?.nameZh ?? null,
          colorCSS: tag.color.primary.css,
          colorHex: tag.color.primary.hex,
          secondaryColorCSS: tag.color.secondary ? tag.color.secondary.css : null,
          dumps: [],
        }
      }

      categories[category].materials[material].colors[color].dumps.push({
        uid: tag.uid,
        spoolWeight: tag.spoolWeight,
        filamentLength: tag.filamentLength,
        diameter: tag.filamentDiameter,
        nozzleDiameter: tag.nozzleDiameter,
        temps: {
          drying: tag.temperatures.dryingTemp,
          dryingTime: tag.temperatures.dryingTime,
          bed: tag.temperatures.bedTemp,
          hotendMin: tag.temperatures.hotendMin,
          hotendMax: tag.temperatures.hotendMax,
        },
        dumpBase64: data.toString('base64'),
      })

      totalDumps++
    } catch (e: any) {
      errors.push({ file: filePath, error: e.message })
    }
  }

  // Sort
  const sortedCategories: Record<string, any> = {}
  const catKeys = Object.keys(categories).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  for (const catKey of catKeys) {
    const cat = categories[catKey]
    const sortedMaterials: Record<string, any> = {}
    const matKeys = Object.keys(cat.materials).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    for (const matKey of matKeys) {
      const mat = cat.materials[matKey]
      const sortedColors: Record<string, any> = {}
      const colorKeys = Object.keys(mat.colors).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      for (const ck of colorKeys) {
        const color = mat.colors[ck]
        color.dumps.sort((a: { dumpBase64: string; uid: string }, b: { dumpBase64: string; uid: string }) => {
          const ka = dumpProductionSortKey(Uint8Array.from(Buffer.from(a.dumpBase64, 'base64')))
          const kb = dumpProductionSortKey(Uint8Array.from(Buffer.from(b.dumpBase64, 'base64')))
          if (ka === kb) return a.uid.localeCompare(b.uid)
          if (!ka) return 1
          if (!kb) return -1
          return kb.localeCompare(ka)
        })
        sortedColors[ck] = color
      }
      sortedMaterials[matKey] = { ...mat, colors: sortedColors }
    }
    sortedCategories[catKey] = { materials: sortedMaterials }
  }

  const output = { generated: new Date().toISOString(), totalDumps, categories: sortedCategories }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output))
  const sizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1)

  console.log('\nResults:')
  console.log('  Total dumps:        ' + totalDumps)
  console.log('  Categories:         ' + catKeys.length)
  console.log('  Reclassified:       ' + reclassified + ' (category/material differs from upstream dir)')
  console.log('  Renamed:            ' + renamed + ' (colour name resolved from official DB)')
  console.log('  Skipped:            ' + skipped)
  console.log('  Invalid trailers:   ' + invalidTrailers + ' (not 87878769 — would be rejected by import)')
  console.log('  Errors:             ' + errors.length)
  console.log('  Output:             ' + OUTPUT_FILE + ' (' + sizeMB + ' MB)')

  if (errors.length > 0) {
    console.log('\nErrors:')
    for (const e of errors.slice(0, 10)) console.log('  ' + e.file + ': ' + e.error)
    if (errors.length > 10) console.log('  ... and ' + (errors.length - 10) + ' more')
  }

  if (shouldCleanup) {
    console.log('\nCleaning up cloned repo...')
    fs.rmSync(LIBRARY_DIR, { recursive: true, force: true })
  }
}

main()
