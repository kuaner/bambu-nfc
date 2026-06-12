import en from './en'
import zh from './zh'

const dictionaries: Record<string, Record<string, string>> = { en, zh }

export type Locale = 'en' | 'zh'

class I18nStore {
  locale = $state<Locale>('en')

  constructor() {
    const nav = navigator.language.toLowerCase()
    this.locale = nav.startsWith('zh') ? 'zh' : 'en'
  }

  t(key: string): string {
    return dictionaries[this.locale][key] ?? key
  }

  toggle(): void {
    this.locale = this.locale === 'en' ? 'zh' : 'en'
  }
}

export const i18n = new I18nStore()
export const t = i18n.t.bind(i18n)
