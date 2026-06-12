#!/usr/bin/env node
/**
 * Scan the Bambu-Lab-RFID-Library and generate a JSON database
 * of all available NFC tag dumps for the web writer tool.
 *
 * Usage: node scripts/generate-db.js [library-path] [output-path]
 *   library-path: path to bambu-rfid-library (default: ./bambu-rfid-library)
 *   output-path:  path to output JSON file (default: ./public/bambu-tags.json)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { parseTagDump, EXPECTED_DUMP_SIZE } from '../src/lib/nfc-parser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const REPO_URL = 'https://github.com/queengooborg/Bambu-Lab-RFID-Library.git'
const LIBRARY_DIR = process.argv[2] || path.join(ROOT, 'bambu-rfid-library')
const OUTPUT_FILE = process.argv[3] || path.join(ROOT, 'public', 'bambu-tags.json')
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

const VALID_CATEGORIES = ['PLA', 'PETG', 'ABS', 'ASA', 'PA', 'PC', 'TPU', 'Support Material']

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

  const allFiles = walkDir(LIBRARY_DIR)
  const binFiles = allFiles.filter(isDumpFile)
  console.log('Found ' + binFiles.length + ' .bin dump files')

  const categories: Record<string, any> = {}
  let totalDumps = 0
  let skipped = 0
  const errors: { file: string; error: string }[] = []

  for (const filePath of binFiles) {
    try {
      const data = fs.readFileSync(filePath)
      if (data.length !== EXPECTED_DUMP_SIZE) { skipped++; continue }

      const tag = parseTagDump(new Uint8Array(data))
      if (!tag) { skipped++; continue }

      const pathInfo = parsePathSegments(filePath)
      if (!pathInfo) { skipped++; continue }

      const { category, material, color } = pathInfo

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
      for (const ck of colorKeys) sortedColors[ck] = mat.colors[ck]
      sortedMaterials[matKey] = { ...mat, colors: sortedColors }
    }
    sortedCategories[catKey] = { materials: sortedMaterials }
  }

  const output = { generated: new Date().toISOString(), totalDumps, categories: sortedCategories }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output))
  const sizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1)

  console.log('\nResults:')
  console.log('  Total dumps: ' + totalDumps)
  console.log('  Categories:  ' + catKeys.length)
  console.log('  Skipped:     ' + skipped)
  console.log('  Errors:      ' + errors.length)
  console.log('  Output:      ' + OUTPUT_FILE + ' (' + sizeMB + ' MB)')

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
