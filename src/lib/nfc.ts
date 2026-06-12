import { Buffer as SDKBuffer, DeviceMode } from 'chameleon-ultra.js'
import type { ChameleonUltra } from 'chameleon-ultra.js'
import { parseTagDump, type ParsedTag } from './nfc-parser'

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function base64ToSdkBuffer(b64: string): InstanceType<typeof SDKBuffer> {
  const b = atob(b64)
  const u = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i)
  return SDKBuffer.from(u)
}

async function deriveKeys(uid: Uint8Array): Promise<Uint8Array[]> {
  const salt = new Uint8Array([0x9a,0x75,0x9c,0xf2,0xc4,0xf7,0xca,0xff,0x22,0x2c,0xb9,0x76,0x9b,0x41,0xbc,0x96])
  const km = await crypto.subtle.importKey('raw', uid.buffer as ArrayBuffer, { name: 'HKDF' }, false, ['deriveBits'])
  const a = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('RFID-A\0') }, km, 768
  ))
  const b = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('RFID-B\0') }, km, 768
  ))
  const keys: Uint8Array[] = []
  for (let i = 0; i < 16; i++) keys.push(a.slice(i * 6, (i + 1) * 6))
  for (let i = 0; i < 16; i++) keys.push(b.slice(i * 6, (i + 1) * 6))
  return keys
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
    const keys = await deriveKeys(new Uint8Array(card.uid))
    const buf = new Uint8Array(1024)
    let ok = true
    for (let s = 0; s < 16; s++) {
      let sd: Uint8Array | null = null
      for (let ki = 0; ki < 2; ki++) {
        try {
          const r = await ultra.mf1ReadSectorByKeys(s, [SDKBuffer.from(keys[ki ? 16 + s : s])])
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

export async function writeTag(
  ultra: ChameleonUltra,
  dump: { dumpBase64: string },
  onProgress: ProgressCallback
): Promise<boolean> {
  await ultra.cmdChangeDeviceMode(DeviceMode.READER)
  const cards = await ultra.cmdHf14aScan()
  if (!cards || !cards.length) return false

  const card = cards[0]

  let gen1a = false
  try { await ultra.mf1Gen1aReadBlocks(0, 1); gen1a = true } catch {}

  const dd = base64ToSdkBuffer(dump.dumpBase64)

  if (gen1a) {
    for (let s = 0; s < 16; s++) {
      const sd = dd.subarray(s * 64, s * 64 + 64)
      let retries = 3, ok = false
      while (retries > 0 && !ok) {
        try { await ultra.mf1Gen1aWriteBlocks(s * 4, sd); ok = true }
        catch { retries--; if (!retries) throw new Error(`Write sector ${s} failed`); await sleep(300) }
      }
      onProgress(s + 1, 16)
      await sleep(80)
    }
  } else {
    const keys = await deriveKeys(new Uint8Array(card.uid))
    for (let s = 0; s < 16; s++) {
      if (s === 0) { onProgress(1, 16); continue }
      const sd = dd.subarray(s * 64, s * 64 + 64)
      let w = false
      for (let ki = 0; ki < 2; ki++) {
        try { await ultra.mf1WriteSectorByKeys(s, [SDKBuffer.from(keys[ki ? 16 + s : s])], sd); w = true; break } catch {}
      }
      if (!w) throw new Error(`Write sector ${s} failed`)
      onProgress(s + 1, 16)
      await sleep(80)
    }
  }
  return true
}
