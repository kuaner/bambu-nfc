import { Buffer as SDKBuffer, DeviceMode } from 'chameleon-ultra.js'
import type { ChameleonUltra } from 'chameleon-ultra.js'
import { parseTagDump, type ParsedTag } from './nfc-parser'

const BAMBU_SECTOR_COUNT = 16
/** Format (16 sectors) + write (16 sectors) */
export const WRITE_PROGRESS_TOTAL = BAMBU_SECTOR_COUNT * 2
export { BAMBU_SECTOR_COUNT }
const FF_KEY = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF])
const DEFAULT_ACCESS = new Uint8Array([0xFF, 0x07, 0x80, 0x69])
const ZERO_BLOCK = new Uint8Array(16)

// BALANCED mode defaults from BambuNfcTool NfcCompatibilityConfig
const AUTH_RETRY_COUNT = 3
const BLOCK_RETRY_COUNT = 1
const WRITE_INTER_BLOCK_DELAY_MS = 100
const POST_KEY_DERIVATION_DELAY_MS = 90

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function base64ToSdkBuffer(b64: string): InstanceType<typeof SDKBuffer> {
  const b = atob(b64)
  const u = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i)
  return SDKBuffer.from(u)
}

function toKeyBufs(keys: Uint8Array[]): InstanceType<typeof SDKBuffer>[] {
  return keys.map(k => SDKBuffer.from(k))
}

/** Interleaved key list — mirrors MifareClassicSession.KeyOrder.INTERLEAVED_BY_INDEX */
function interleavedKeys(keysA: Uint8Array[], keysB: Uint8Array[]): Uint8Array[] {
  const keys: Uint8Array[] = []
  const maxLen = Math.max(keysA.length, keysB.length)
  for (let i = 0; i < maxLen; i++) {
    if (keysA[i]) keys.push(keysA[i])
    if (keysB[i]) keys.push(keysB[i])
  }
  return keys
}

function buildTrailer(keyA: Uint8Array, access: Uint8Array, keyB: Uint8Array): Uint8Array {
  const trailer = new Uint8Array(16)
  trailer.set(keyA, 0)
  trailer.set(access, 6)
  trailer.set(keyB, 10)
  return trailer
}

function defaultFfTrailer(): Uint8Array {
  return buildTrailer(FF_KEY, DEFAULT_ACCESS, FF_KEY)
}

async function deriveKeys(uid: Uint8Array): Promise<{ keyA: Uint8Array[], keyB: Uint8Array[] }> {
  const uidCopy = new Uint8Array(uid)
  const salt = new Uint8Array([0x9a,0x75,0x9c,0xf2,0xc4,0xf7,0xca,0xff,0x22,0x2c,0xb9,0x76,0x9b,0x41,0xbc,0x96])
  const km = await crypto.subtle.importKey('raw', uidCopy.buffer, { name: 'HKDF' }, false, ['deriveBits'])
  const a = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('RFID-A\0') }, km, 768
  ))
  const b = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('RFID-B\0') }, km, 768
  ))
  const keyA: Uint8Array[] = []
  const keyB: Uint8Array[] = []
  for (let i = 0; i < 16; i++) keyA.push(a.slice(i * 6, (i + 1) * 6))
  for (let i = 0; i < 16; i++) keyB.push(b.slice(i * 6, (i + 1) * 6))
  return { keyA, keyB }
}

/** Authenticate sector — mirrors BambuMifareOperator.authenticate() */
async function authenticate(
  ultra: ChameleonUltra,
  sector: number,
  keysA: Uint8Array[],
  keysB: Uint8Array[]
): Promise<boolean> {
  const keys = interleavedKeys(keysA, keysB)
  if (!keys.length) return false
  const block = sector * 4 + (sector === 0 ? 1 : 0)
  for (let attempt = 0; attempt <= AUTH_RETRY_COUNT; attempt++) {
    try {
      await ultra.mf1ReadBlockByKeys(block, toKeyBufs(keys))
      return true
    } catch {
      if (attempt < AUTH_RETRY_COUNT) await sleep(75)
    }
  }
  return false
}

async function readBlockWithRetry(
  ultra: ChameleonUltra,
  block: number,
  keysA: Uint8Array[],
  keysB: Uint8Array[]
): Promise<Uint8Array | null> {
  const sector = Math.trunc(block / 4)
  const keys = interleavedKeys(keysA, keysB)
  for (let attempt = 0; attempt <= BLOCK_RETRY_COUNT; attempt++) {
    try {
      const data = await ultra.mf1ReadBlockByKeys(block, toKeyBufs(keys))
      return new Uint8Array(data)
    } catch {
      if (attempt < BLOCK_RETRY_COUNT) {
        await authenticate(ultra, sector, keysA, keysB)
        await sleep(75)
      }
    }
  }
  return null
}

/** Write block with re-auth on failure — mirrors BambuMifareOperator.writeBlockWithRetry() */
async function writeBlockWithRetry(
  ultra: ChameleonUltra,
  block: number,
  keysA: Uint8Array[],
  keysB: Uint8Array[],
  data: Uint8Array
): Promise<boolean> {
  const sector = Math.trunc(block / 4)
  const keys = interleavedKeys(keysA, keysB)
  for (let attempt = 0; attempt <= BLOCK_RETRY_COUNT; attempt++) {
    try {
      if (attempt > 0 && WRITE_INTER_BLOCK_DELAY_MS > 0) await sleep(WRITE_INTER_BLOCK_DELAY_MS)
      await ultra.mf1WriteBlockByKeys(block, toKeyBufs(keys), SDKBuffer.from(data))
      return true
    } catch {
      if (attempt < BLOCK_RETRY_COUNT) {
        await authenticate(ultra, sector, keysA, keysB)
        await sleep(75)
      }
    }
  }
  return false
}

async function tryResetDefaultTrailerWithFf(
  ultra: ChameleonUltra,
  sector: number,
  trailerBlock: number
): Promise<boolean> {
  if (!(await authenticate(ultra, sector, [], [FF_KEY]))) return false
  return writeBlockWithRetry(ultra, trailerBlock, [], [FF_KEY], defaultFfTrailer())
}

/** Mirrors BambuMifareOperator.resetTrailerToDefaultFf() */
async function resetTrailerToDefaultFf(
  ultra: ChameleonUltra,
  sector: number,
  derivedKeyA: Uint8Array,
  derivedKeyB: Uint8Array
): Promise<boolean> {
  const trailerBlock = sector * 4 + 3
  const stages = [
    { requiredKeyB: derivedKeyB, trailer: buildTrailer(derivedKeyA, DEFAULT_ACCESS, derivedKeyB) },
    { requiredKeyB: derivedKeyB, trailer: defaultFfTrailer() },
  ]

  for (const stage of stages) {
    if (!(await authenticate(ultra, sector, [], [stage.requiredKeyB]))) {
      return tryResetDefaultTrailerWithFf(ultra, sector, trailerBlock)
    }
    if (!(await writeBlockWithRetry(ultra, trailerBlock, [], [stage.requiredKeyB], stage.trailer))) {
      return false
    }
    if (WRITE_INTER_BLOCK_DELAY_MS > 0) await sleep(WRITE_INTER_BLOCK_DELAY_MS)
  }

  return authenticate(ultra, sector, [FF_KEY], [FF_KEY])
}

/** Mirrors BambuMifareOperator.formatToDefaultFf() */
async function formatToDefaultFf(
  ultra: ChameleonUltra,
  sectorKeys: { keyA: Uint8Array[], keyB: Uint8Array[] },
  onProgress: ProgressCallback
): Promise<void> {
  const originalBlock0 = await readBlockWithRetry(ultra, 0, [sectorKeys.keyA[0]], [FF_KEY])
  if (!originalBlock0) throw new Error('nfc.format_sector0_auth')

  for (let sector = 0; sector < BAMBU_SECTOR_COUNT; sector++) {
    const ok = await resetTrailerToDefaultFf(
      ultra, sector, sectorKeys.keyA[sector], sectorKeys.keyB[sector]
    )
    if (!ok) throw new Error(`nfc.format_trailer_reset:${sector}`)

    if (!(await authenticate(ultra, sector, [FF_KEY], [FF_KEY]))) {
      throw new Error(`nfc.format_ff_auth:${sector}`)
    }
    for (let offset = 0; offset < 3; offset++) {
      const blockIndex = sector * 4 + offset
      if (blockIndex === 0) continue
      if (!(await writeBlockWithRetry(ultra, blockIndex, [FF_KEY], [FF_KEY], ZERO_BLOCK))) {
        throw new Error(`nfc.format_clear_block:${sector}:${blockIndex}`)
      }
    }

    for (let offset = 0; offset < 3; offset++) {
      const blockIndex = sector * 4 + offset
      const block = await readBlockWithRetry(ultra, blockIndex, [FF_KEY], [FF_KEY])
      if (!block) throw new Error(`nfc.format_verify_read:${sector}:${blockIndex}`)
      if (blockIndex === 0) {
        if (!block.every((b, i) => b === originalBlock0[i])) {
          throw new Error('nfc.format_verify_block0')
        }
      } else if (!block.every(b => b === 0)) {
        throw new Error(`nfc.format_verify_not_zero:${blockIndex}`)
      }
    }

    onProgress(sector + 1, WRITE_PROGRESS_TOTAL)
  }
}

/** Mirrors BambuMifareOperator.writeDumpWithFf() */
async function writeDumpWithFf(
  ultra: ChameleonUltra,
  dump: InstanceType<typeof SDKBuffer>,
  onProgress: ProgressCallback
): Promise<boolean> {
  for (let sector = 0; sector < BAMBU_SECTOR_COUNT; sector++) {
    if (!(await authenticate(ultra, sector, [FF_KEY], [FF_KEY]))) {
      throw new Error(`nfc.write_ff_auth:${sector}`)
    }

    for (let offset = 0; offset < 4; offset++) {
      const blockIndex = sector * 4 + offset
      const data = new Uint8Array(dump.subarray(blockIndex * 16, blockIndex * 16 + 16))

      if (blockIndex === 0) {
        try {
          await ultra.mf1WriteBlockByKeys(0, toKeyBufs([FF_KEY]), SDKBuffer.from(data))
        } catch {
          try {
            await ultra.mf1Gen1aWriteBlocks(0, SDKBuffer.from(data))
          } catch {
            // Block 0 skipped — UID unchanged on this card
          }
        }
        continue
      }

      if (!(await writeBlockWithRetry(ultra, blockIndex, [FF_KEY], [FF_KEY], data))) {
        throw new Error(`nfc.write_block:${blockIndex}`)
      }
    }

    onProgress(BAMBU_SECTOR_COUNT + sector + 1, WRITE_PROGRESS_TOTAL)
  }

  return true
}

export interface ReadResult {
  parsed: ParsedTag
  uidHex: string
}

export async function readTag(ultra: ChameleonUltra): Promise<ReadResult | null> {
  await ultra.cmdChangeDeviceMode(DeviceMode.READER)
  const cards = await ultra.cmdHf14aScan()
  if (!cards || !cards.length) return null

  const card = cards[0]
  const uidHex = Array.from(new Uint8Array(card.uid))
    .map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('')

  let dumpData: Uint8Array | null = null

  try {
    const raw = await ultra.mf1Gen1aReadBlocks(0, 64)
    dumpData = new Uint8Array(raw)
  } catch {
    const { keyA, keyB } = await deriveKeys(new Uint8Array(card.uid))
    const buf = new Uint8Array(1024)
    let ok = true
    for (let s = 0; s < 16; s++) {
      let sd: Uint8Array | null = null
      for (const key of [keyA[s], keyB[s]]) {
        try {
          const r = await ultra.mf1ReadSectorByKeys(s, [SDKBuffer.from(key)])
          sd = new Uint8Array(r.data)
          break
        } catch { continue }
      }
      if (!sd) { ok = false; break }
      buf.set(sd, s * 64)
    }
    if (ok) dumpData = buf
  }

  if (!dumpData || dumpData.length !== 1024) return null
  const parsed = parseTagDump(dumpData)
  if (!parsed) return null
  return { parsed, uidHex }
}

export type ProgressCallback = (current: number, total: number, message?: string) => void

/** Mirrors BambuNfcTool FormatThenWriteDump */
export async function writeTag(
  ultra: ChameleonUltra,
  dump: { dumpBase64: string },
  onProgress: ProgressCallback
): Promise<boolean> {
  await ultra.cmdChangeDeviceMode(DeviceMode.READER)
  const cards = await ultra.cmdHf14aScan()
  if (!cards || !cards.length) return false

  const sectorKeys = await deriveKeys(new Uint8Array(cards[0].uid))
  const dd = base64ToSdkBuffer(dump.dumpBase64)

  onProgress(0, WRITE_PROGRESS_TOTAL)
  await sleep(POST_KEY_DERIVATION_DELAY_MS)
  await formatToDefaultFf(ultra, sectorKeys, onProgress)
  return writeDumpWithFf(ultra, dd, onProgress)
}
