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
 * After the upstream scan, the Android app's current shared tag library is
 * downloaded and decrypted in-process (credentials come from
 * APP_SHARED_INSTALL_ID / APP_SHARED_TAG_PACKAGE_KEY). Dumps are merged only
 * for material/colour pairs the upstream library does not have; existing
 * pairs stay authoritative. Nothing is committed between builds.
 *
 * Usage: node scripts/generate-db.js [library-path] [output-path]
 *   library-path: path to bambu-rfid-library (default: ./bambu-rfid-library)
 *   output-path:  path to output JSON file (default: ./src/data/bambu-tags.json)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { parseTagDump, dumpProductionSortKey, EXPECTED_DUMP_SIZE } from '../src/lib/nfc-parser.js'
import { loadAppSharedDumps, type AppSharedDump } from './lib/app-shared.js'
import {
  isImportableBambuTag,
  VALID_CATEGORIES,
  FILAMENT_TYPE_TO_CATEGORY,
  DETAILED_TYPE_TO_CATEGORY,
  canonicalizeDetailedType,
  loadColorDB,
  lookupColorName,
  lookupAppColorName,
  comboKey,
} from './lib/tag-db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const REPO_URL = 'https://github.com/queengooborg/Bambu-Lab-RFID-Library.git'
const LIBRARY_DIR = process.argv[2] || path.join(ROOT, 'bambu-rfid-library')
const OUTPUT_FILE = process.argv[3] || path.join(ROOT, 'src', 'data', 'bambu-tags.json')
const shouldCleanup = !process.argv[2]

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

async function main(): Promise<void> {
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
  let appSharedAdded = 0
  let appSharedSkippedExisting = 0
  let appSharedSkipped = 0
  const errors: { file: string; error: string }[] = []
  const combos = new Set<string>()
  let upstreamCombos = new Set<string>()

  function ingest(
    data: Buffer,
    pathInfo: { category: string; material: string; color: string } | null,
    appDump: AppSharedDump | null = null,
    newCombosOnly = false,
  ): boolean {
    if (data.length !== EXPECTED_DUMP_SIZE) {
      skipped++
      if (appDump) appSharedSkipped++
      return false
    }

    const bytes = new Uint8Array(data)
    if (!isImportableBambuTag(bytes)) {
      invalidTrailers++
      if (appDump) appSharedSkipped++
      return false
    }

    const tag = parseTagDump(bytes)
    if (!tag) {
      skipped++
      if (appDump) appSharedSkipped++
      return false
    }

    // The app library identifies colours by block 1 (material id + colour
    // code) first; upstream dumps keep the RGB-based lookup.
    const appEntry = appDump ? lookupAppColorName(tag, colorDB) : null
    const detailedType = canonicalizeDetailedType(tag.detailedFilamentType)
    const appMaterial = appEntry?.fila_type ? canonicalizeDetailedType(appEntry.fila_type) : ''

    // Resolve category: detailed type → app material → short type → directory.
    const category =
      DETAILED_TYPE_TO_CATEGORY[detailedType] ??
      DETAILED_TYPE_TO_CATEGORY[appMaterial] ??
      FILAMENT_TYPE_TO_CATEGORY[tag.filamentType] ??
      pathInfo?.category ??
      null
    // Resolve material: detailed type → app material → short type → directory.
    const material = detailedType || appMaterial || tag.filamentType || pathInfo?.material || null
    // Resolve colour: app block-1 code → official DB → directory → raw hex.
    const official = appEntry
      ? {
          name: appEntry.fila_color_name.en || '',
          nameZh: appEntry.fila_color_name.zh ?? null,
          exact: true,
        }
      : lookupColorName(tag, detailedType, colorDB)
    const color = official?.name ?? pathInfo?.color ?? tag.color.primary.hex.toUpperCase()

    if (!category || !material || !color || !VALID_CATEGORIES.includes(category)) {
      skipped++
      if (appDump) appSharedSkipped++
      return false
    }

    // App dumps only fill colour/material combinations the upstream lacks.
    if (appDump && !/^[\x20-\x7E]*[A-Za-z]/.test(material)) {
      appSharedSkipped++
      return false
    }
    const key = comboKey(material, color)
    if (newCombosOnly && upstreamCombos.has(key)) {
      appSharedSkippedExisting++
      return false
    }

    // Telemetry: how much did data-driven classification move things?
    if (!appDump) {
      if (pathInfo && (pathInfo.category !== category || pathInfo.material !== material)) reclassified++
      if (pathInfo && pathInfo.color !== color) renamed++
    }

    if (!categories[category]) categories[category] = { materials: {} }
    if (!categories[category].materials[material]) {
      categories[category].materials[material] = {
        displayName: material,
        filamentType: tag.filamentType || appMaterial || '',
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
      uid: appDump?.uid || tag.uid,
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

    combos.add(key)
    totalDumps++
    return true
  }

  for (const filePath of binFiles) {
    try {
      const data = fs.readFileSync(filePath)
      ingest(data, parsePathSegments(filePath))
    } catch (e: any) {
      errors.push({ file: filePath, error: e.message })
    }
  }

  upstreamCombos = new Set(combos)

  // Download the current app library on every build; no snapshot is committed.
  const appDumps = await loadAppSharedDumps({})
  if (appDumps.length > 0) {
    for (const dump of appDumps) {
      try {
        if (ingest(Buffer.from(dump.data), null, dump, true)) appSharedAdded++
      } catch (e: any) {
        errors.push({ file: `app-shared:${dump.uid}`, error: e.message })
      }
    }
    console.log(
      `App shared library result: +${appSharedAdded} dumps, ` +
        `${appSharedSkippedExisting} covered by upstream, ${appSharedSkipped} skipped`,
    )
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
  console.log('  App shared dumps:   +' + appSharedAdded + ' (' + appSharedSkippedExisting + ' covered by upstream, ' + appSharedSkipped + ' skipped)')
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

main().catch(e => {
  console.error(e)
  process.exit(1)
})
