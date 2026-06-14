import { ChameleonUltra } from 'chameleon-ultra.js'
import type { ChameleonUltra as ChameleonUltraType } from 'chameleon-ultra.js'
import WebbleAdapter from 'chameleon-ultra.js/plugin/WebbleAdapter'

class BluetoothStore {
  isConnected = $state(false)
  isConnecting = $state(false)
  error = $state<string | null>(null)
  /** Last disconnect reason captured from the SDK, if any. */
  lastDisconnectReason = $state<string | null>(null)

  #ultra: ChameleonUltraType | null = null
  #onDisconnected: ((when: Date, reason?: string) => void) | null = null

  get ultra(): ChameleonUltraType | null { return this.#ultra }

  async connect(): Promise<void> {
    // Tear down any previous instance first so we never leave dangling
    // event listeners pointing at an old ChameleonUltra object.
    await this.disconnectInternal()

    this.isConnecting = true
    this.error = null
    try {
      const ultra = new ChameleonUltra()
      // @ts-expect-error chameleon-ultra.js: WebbleAdapter #private mismatch with UltraPlugin across d.ts bundles
      await ultra.use(new WebbleAdapter())
      await ultra.connect()

      // Keep our state in sync with the device. The SDK emits this on
      // GATT drop, idle/sleep, response timeouts — anything that ends
      // the read loop. Without this we'd report "connected" forever.
      const handler = (when: Date, reason?: string): void => {
        // Skip if we've already moved on to a new connection.
        if (this.#ultra !== ultra) return
        this.lastDisconnectReason = reason ?? 'disconnected'
        this.#ultra = null
        this.#onDisconnected = null
        this.isConnected = false
      }
      ultra.emitter.on('disconnected', handler)
      this.#onDisconnected = handler

      this.#ultra = ultra
      this.isConnected = true
    } catch (e: any) {
      this.error = e.message
      await this.disconnectInternal()
    }
    this.isConnecting = false
  }

  /** Internal teardown: drop the listener, clear the instance. No state churn. */
  private async disconnectInternal(): Promise<void> {
    const ultra = this.#ultra
    this.#ultra = null
    this.#onDisconnected = null
    if (ultra) {
      try { await ultra.disconnect() } catch {}
    }
  }

  async disconnect(): Promise<void> {
    await this.disconnectInternal()
    this.isConnected = false
    this.error = null
    this.lastDisconnectReason = null
  }

  /** Debug: skip Bluetooth, fake connected state */
  connectDebug(): void {
    this.isConnected = true
    this.error = null
  }
}

export const bluetooth = new BluetoothStore()
