/**
 * Fetch the Android app's shared Bambu tag library at build time.
 *
 * The release pipeline calls this from generate-db.ts. Credentials are read
 * from GitHub Actions secrets (APP_SHARED_INSTALL_ID / APP_SHARED_TAG_PACKAGE_KEY)
 * or a pre-downloaded zip (APP_SHARED_ZIP) for local debugging. No snapshot is
 * committed: every build downloads the current library, decrypts it, extracts
 * the `<UID>.txt` dumps and lets the generator merge the missing colours.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { execFileSync } from 'child_process'

const DEFAULT_BASE_URL = 'https://brr.jacki.cn'
const USER_AGENT = 'Dalvik/2.1.0 (Linux; U; Android 14; Pixel 8 Build/AP2A.240905.003)'

export interface AppSharedDump {
  uid: string
  data: Uint8Array
}

export interface AppSharedOptions {
  installId?: string
  packageKey?: string
  zipPath?: string
  baseUrl?: string
  brand?: string
}

function packagePassword(installId: string, packageKey: string): string {
  return crypto.createHash('sha256').update(`${installId}:${packageKey}`, 'utf8').digest('hex').slice(0, 16)
}

function decryptM0rf(raw: Buffer, password: string): Buffer {
  if (raw.subarray(0, 4).toString('ascii') !== 'M0RF') {
    throw new Error('not an M0RF package')
  }
  const salt = raw.subarray(4, 20)
  const nonce = raw.subarray(20, 32)
  const ciphertext = raw.subarray(32)
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
  const tag = ciphertext.subarray(ciphertext.length - 16)
  const body = ciphertext.subarray(0, ciphertext.length - 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(body), decipher.final()])
}

async function downloadPackage(
  baseUrl: string,
  installId: string,
  packageKey: string,
  brand: string,
): Promise<Buffer> {
  const permissionUrl = `${baseUrl}/api/public/tags/can-download?install_id=${encodeURIComponent(installId)}`
  const permissionRes = await fetch(permissionUrl, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  })
  const permissionText = await permissionRes.text()
  if (!permissionRes.ok) {
    throw new Error(`permission check HTTP ${permissionRes.status}: ${permissionText.slice(0, 160)}`)
  }
  let permission: any
  try {
    permission = JSON.parse(permissionText)
  } catch {
    throw new Error(`permission check returned non-JSON: ${permissionText.slice(0, 160)}`)
  }
  if (!permission.allowed) {
    throw new Error(`download not allowed: ${permission.reason || 'no reason'}`)
  }

  const res = await fetch(`${baseUrl}/api/public/tags/download/v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/octet-stream',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ install_id: installId, brand }),
  })
  if (!res.ok) {
    throw new Error(`download HTTP ${res.status}`)
  }
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.subarray(0, 4).toString('ascii') !== 'M0RF') {
    throw new Error('download returned a non-M0RF body (WAF or login wall)')
  }
  return bytes
}

function extractZip(zipPath: string): { dir: string; owned: boolean } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bambu-app-library-'))
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', dir], { stdio: 'ignore' })
  return { dir, owned: true }
}

function walkTxt(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkTxt(full))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) out.push(full)
  }
  return out
}

function readDump(file: string): AppSharedDump | null {
  const uid = path.basename(file, path.extname(file)).toUpperCase()
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length !== 64) return null
  if (lines.some(l => l.length !== 32 || !/^[0-9A-Fa-f]+$/.test(l))) return null
  return { uid, data: Uint8Array.from(Buffer.from(lines.join(''), 'hex')) }
}

/**
 * Returns every parseable dump from the app library. Invalid/partial files are
 * skipped with a count; transport failures return [] unless
 * APP_SHARED_STRICT=1, so an API outage does not block a release.
 */
export async function loadAppSharedDumps(opts: AppSharedOptions): Promise<AppSharedDump[]> {
  const baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '')
  const brand = opts.brand || 'bambu'
  const installId = opts.installId || process.env.APP_SHARED_INSTALL_ID
  const packageKey = opts.packageKey || process.env.APP_SHARED_TAG_PACKAGE_KEY
  const zipPath = opts.zipPath || process.env.APP_SHARED_ZIP
  const strict = process.env.APP_SHARED_STRICT === '1'

  if (!zipPath && (!installId || !packageKey)) {
    console.log('App shared library: no APP_SHARED_INSTALL_ID / APP_SHARED_TAG_PACKAGE_KEY, skipped')
    return []
  }

  let workDir: string | null = null
  try {
    let zipFile: string
    if (zipPath) {
      zipFile = zipPath
    } else {
      console.log(`App shared library: downloading ${brand} package...`)
      const packageBytes = await downloadPackage(baseUrl, installId!, packageKey!, brand)
      const zipBytes = decryptM0rf(packageBytes, packagePassword(installId!, packageKey!))
      workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bambu-app-zip-'))
      zipFile = path.join(workDir, 'shared_library.zip')
      fs.writeFileSync(zipFile, zipBytes)
      console.log(`App shared library: package ${packageBytes.length} B -> zip ${zipBytes.length} B`)
    }

    const extracted = extractZip(zipFile)
    try {
      const files = walkTxt(extracted.dir)
      const dumps: AppSharedDump[] = []
      let invalid = 0
      for (const file of files) {
        const dump = readDump(file)
        if (!dump || dump.data.length !== 1024) {
          invalid++
          continue
        }
        dumps.push(dump)
      }
      console.log(`App shared library: ${files.length} files, ${dumps.length} dumps (${invalid} invalid)`)
      return dumps
    } finally {
      fs.rmSync(extracted.dir, { recursive: true, force: true })
    }
  } catch (e: any) {
    const message = `App shared library unavailable: ${e.message}`
    if (strict) throw new Error(message)
    console.warn(message)
    return []
  } finally {
    if (workDir) fs.rmSync(workDir, { recursive: true, force: true })
  }
}