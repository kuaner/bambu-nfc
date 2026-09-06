/**
 * Bambu NFC Tag Parser
 *
 * Parses MIFARE Classic 1K (1024 bytes) dump data for Bambu Lab RFID tags.
 * Reference: https://github.com/Bambu-Research-Group/RFID-Tag-Guide
 *
 * Block layout:
 *   Block 0:  UID + Manufacturer Data (read-only)
 *   Block 1:  Tray Info Index (Variant ID + Material ID)
 *   Block 2:  Filament Type (short name)
 *   Block 4:  Detailed Filament Type
 *   Block 5:  Color (RGBA) + Spool Weight + Filament Diameter
 *   Block 6:  Temperatures & Drying Info
 *   Block 8:  X-Cam Info + Nozzle Diameter
 *   Block 9:  Tray UID
 *   Block 10: Spool Width
 *   Block 12: Production Date/Time
 *   Block 13: Short Production Date/Time
 *   Block 14: Filament Length
 *   Block 16: Extra Color Info (format id, color count, second color in ABGR)
 *   Block 17: Unknown
 *   Blocks 18-39: Empty
 *   Blocks 40-63: RSA-2048 Signature (read-only)
 *
 * All integers are Little Endian. All floats are Little Endian IEEE 754.
 * Block 3 of every sector = MIFARE sector trailer (Key A + Access Bits + Key B).
 * Access bits are always 87 87 87 69 for Bambu tags. B-key is always 00×6.
 */

export const EXPECTED_DUMP_SIZE = 1024

export interface TagTemperatures {
  dryingTemp: number
  dryingTime: number
  bedTempType: number
  bedTemp: number
  hotendMax: number
  hotendMin: number
}

export interface TagColor {
  count: number
  primary: { hex: string; css: string }
  secondary: { hex: string; css: string } | null
}

export interface ParsedTag {
  uid: string
  variantId: string
  materialId: string
  filamentType: string
  detailedFilamentType: string
  color: TagColor
  spoolWeight: number
  filamentDiameter: number
  filamentLength: number
  spoolWidth: number
  nozzleDiameter: number
  temperatures: TagTemperatures
  xCamInfo: string
  trayUid: string
  productionDate: string
  shortProductionDate: string
}

// --- Byte-level helpers ---

function bytesToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('')
}

function bytesToAscii(buf: Uint8Array): string {
  return new TextDecoder('ascii').decode(buf).replace(/\x00/g, ' ').trim()
}

/**
 * Parse a Bambu date field into `YYYY-MM-DD`, or `''` if it isn't a date.
 *
 * Real tags encode the date in several ways (sampled across 3604 dumps):
 *   block 12 — almost always "YYYY_MM_DD_HH_mm" (the real production date).
 *   block 13 — varies by firmware: "YYYYMMDD", "YY_MM_DD_HH",
 *              "A" + YYMMDD + 4-digit serial, or a non-date serial number.
 *
 * Unrecognised values (serial numbers, blanks) return '' rather than being
 * echoed back — matches the import app, which leaves the field empty when
 * extraction fails.
 */
function formatBambuDate(raw: string): string {
  const key = bambuDateSortKey(raw)
  return key ? key.slice(0, 10) : ''
}

/**
 * Parse a Bambu date field into a sortable `YYYY-MM-DDTHH:mm` key, or `''`.
 * Keeps hours/minutes from block 12 (`YYYY_MM_DD_HH_mm`) so same-day dumps
 * still order by time. Missing time parts default to `00:00`.
 */
export function bambuDateSortKey(raw: string): string {
  const s = raw.trim()
  if (!s) return ''

  // "YYYY_MM_DD_HH_mm" (block 12) or "YY_MM_DD_HH" (block 13)
  const parts = s.split('_')
  if (parts.length >= 3) {
    const y = parts[0].length === 2 ? '20' + parts[0] : parts[0]
    const hh = parts[3] && /^\d{2}$/.test(parts[3]) ? parts[3] : '00'
    const mm = parts[4] && /^\d{2}$/.test(parts[4]) ? parts[4] : '00'
    return `${y}-${parts[1]}-${parts[2]}T${hh}:${mm}`
  }

  // "YYYYMMDD" (8 digits, no separators)
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00`

  // "A" + YYMMDD + 4-digit serial — firmware variant where the leading "A"
  // marks this block as a date and the trailing 4 digits are a spool/batch id.
  if (/^A\d{10}$/.test(s)) {
    const d = s.slice(1) // YYMMDD????
    return `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}T00:00`
  }

  return ''
}

/** Production-time sort key for a 1024-byte dump (block 12, then block 13). */
export function dumpProductionSortKey(data: Uint8Array): string {
  if (data.length !== EXPECTED_DUMP_SIZE) return ''
  const block12 = bytesToAscii(data.subarray(12 * 16, 13 * 16))
  const block13 = bytesToAscii(data.subarray(13 * 16, 14 * 16))
  return bambuDateSortKey(block12) || bambuDateSortKey(block13)
}

function readUint16LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8)
}

function readFloatLE(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 4)
  return view.getFloat32(0, true)
}

// --- Color conversion ---

function rgbaBytesToCSS(buf: Uint8Array): string {
  return `rgb(${buf[0]},${buf[1]},${buf[2]})`
}

function rgbaBytesToHex(buf: Uint8Array): string {
  return '#' + [buf[0], buf[1], buf[2]].map(b => b.toString(16).padStart(2, '0')).join('')
}

function abgrBytesToCSS(buf: Uint8Array): string {
  return `rgb(${buf[3]},${buf[2]},${buf[1]})`
}

// --- Main parser ---

export function parseTagDump(dumpData: Uint8Array | ArrayBuffer): ParsedTag | null {
  const data = new Uint8Array(dumpData)
  if (data.length !== EXPECTED_DUMP_SIZE) return null

  const blocks: Uint8Array[] = []
  for (let i = 0; i < 64; i++) {
    blocks.push(data.slice(i * 16, (i + 1) * 16))
  }

  const hasExtraColor = readUint16LE(blocks[16], 0) === 0x0002
  const colorCount = hasExtraColor ? readUint16LE(blocks[16], 2) : 1

  const primaryColorCSS = rgbaBytesToCSS(blocks[5].slice(0, 4))
  const primaryColorHex = rgbaBytesToHex(blocks[5].slice(0, 4))

  let secondaryColorCSS: string | null = null
  let secondaryColorHex: string | null = null
  if (colorCount >= 2 && hasExtraColor) {
    secondaryColorCSS = abgrBytesToCSS(blocks[16].slice(4, 8))
    const abgrRaw = new Uint8Array(blocks[16].slice(4, 8))
    const r = abgrRaw[3], g = abgrRaw[2], b = abgrRaw[1]
    secondaryColorHex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
  }

  return {
    uid: bytesToHex(blocks[0].slice(0, 4)),
    variantId: bytesToAscii(blocks[1].slice(0, 8)),
    materialId: bytesToAscii(blocks[1].slice(8, 16)),
    filamentType: bytesToAscii(blocks[2]),
    detailedFilamentType: bytesToAscii(blocks[4]),
    color: {
      count: colorCount,
      primary: { hex: primaryColorHex, css: primaryColorCSS },
      secondary: secondaryColorHex ? { hex: secondaryColorHex, css: secondaryColorCSS! } : null,
    },
    spoolWeight: readUint16LE(blocks[5], 4),
    filamentDiameter: Math.round(readFloatLE(blocks[5], 8) * 100) / 100,
    filamentLength: readUint16LE(blocks[14], 4),
    spoolWidth: readUint16LE(blocks[10], 4) / 100,
    nozzleDiameter: Math.round(readFloatLE(blocks[8], 12) * 10) / 10,
    temperatures: {
      dryingTemp: readUint16LE(blocks[6], 0),
      dryingTime: readUint16LE(blocks[6], 2),
      bedTempType: readUint16LE(blocks[6], 4),
      bedTemp: readUint16LE(blocks[6], 6),
      hotendMax: readUint16LE(blocks[6], 8),
      hotendMin: readUint16LE(blocks[6], 10),
    },
    xCamInfo: bytesToHex(blocks[8].slice(0, 12)),
    trayUid: bytesToHex(blocks[9]),
    productionDate: formatBambuDate(bytesToAscii(blocks[12])),
    shortProductionDate: formatBambuDate(bytesToAscii(blocks[13])),
  }
}

export { rgbaBytesToCSS, rgbaBytesToHex }
