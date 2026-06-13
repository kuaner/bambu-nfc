import { t } from './i18n'

/** Translate nfc.ts error codes (e.g. `nfc.write_block:5`) to localized text. */
export function formatNfcError(message: string): string {
  const colon = message.indexOf(':')
  const key = colon === -1 ? message : message.slice(0, colon)
  const args = colon === -1 ? [] : message.slice(colon + 1).split(':')
  const localized = t(key)
  if (localized === key) return message
  return args.reduce((text, arg, i) => text.replace(`{${i}}`, arg), localized)
}
