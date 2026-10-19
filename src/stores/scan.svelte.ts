/**
 * 连续读取历史：每次成功读卡追加一条，不再覆盖上一次的结果。
 * 同一 UID 重读视为同一条（置顶并刷新读取时间）。仅内存记录，刷新页面即清空。
 */
import type { ParsedTag } from '../lib/nfc-parser'

const MAX_ENTRIES = 50

export interface ScanRecord {
  uid: string
  parsed: ParsedTag
  /** 读取时间（epoch ms），新记录在前 */
  time: number
}

class ScanStore {
  #records = $state<ScanRecord[]>([])

  /** 全部读取记录，最新在前 */
  get records(): ScanRecord[] {
    return this.#records
  }

  add(parsed: ParsedTag): void {
    const uidIdx = this.#records.findIndex(r => r.uid.toUpperCase() === parsed.uid.toUpperCase())
    if (uidIdx >= 0) this.#records.splice(uidIdx, 1)
    this.#records.unshift({ uid: parsed.uid, parsed, time: Date.now() })
    if (this.#records.length > MAX_ENTRIES) this.#records.length = MAX_ENTRIES
  }

  remove(uid: string): void {
    const idx = this.#records.findIndex(r => r.uid === uid)
    if (idx < 0) return
    this.#records.splice(idx, 1)
  }

  clear(): void {
    this.#records.length = 0
  }
}

export const scanStore = new ScanStore()
