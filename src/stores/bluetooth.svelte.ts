import { ChameleonUltra } from 'chameleon-ultra.js'
import type { ChameleonUltra as ChameleonUltraType } from 'chameleon-ultra.js'
import WebbleAdapter from 'chameleon-ultra.js/plugin/WebbleAdapter'

class BluetoothStore {
  isConnected = $state(false)
  isConnecting = $state(false)
  error = $state<string | null>(null)

  #ultra: ChameleonUltraType | null = null

  get ultra(): ChameleonUltraType | null { return this.#ultra }

  async connect(): Promise<void> {
    this.isConnecting = true
    this.error = null
    try {
      const ultra = new ChameleonUltra()
      // @ts-expect-error chameleon-ultra.js: WebbleAdapter #private mismatch with UltraPlugin across d.ts bundles
      await ultra.use(new WebbleAdapter())
      await ultra.connect()
      this.#ultra = ultra
      this.isConnected = true
    } catch (e: any) {
      this.error = e.message
      if (this.#ultra) {
        try { await this.#ultra.disconnect() } catch {}
        this.#ultra = null
      }
    }
    this.isConnecting = false
  }

  async disconnect(): Promise<void> {
    try {
      if (this.#ultra) await this.#ultra.disconnect()
    } catch {}
    this.#ultra = null
    this.isConnected = false
    this.error = null
  }

  /** Debug: skip Bluetooth, fake connected state */
  connectDebug(): void {
    this.isConnected = true
    this.error = null
  }
}

export const bluetooth = new BluetoothStore()
