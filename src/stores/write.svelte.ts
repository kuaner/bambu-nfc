import { tagDb, type ColorEntry, type TagDump } from './tag-db.svelte'

class WriteStore {
  selectedCategory = $state('')
  selectedMaterial = $state('')
  selectedColorKey = $state<string | null>(null)
  selectedDump = $state<TagDump | null>(null)
  colorDropdownOpen = $state(false)
  isWriting = $state(false)
  writeProgress = $state<{ current: number; total: number; message?: string } | null>(null)
  writeError = $state<string | null>(null)

  get materials(): string[] {
    return tagDb.getMaterials(this.selectedCategory)
  }

  get colors(): ColorEntry[] {
    return tagDb.getColors(this.selectedCategory, this.selectedMaterial)
  }

  get isReadyToWrite(): boolean {
    return this.selectedDump !== null
  }

  setCategory(name: string): void {
    this.selectedCategory = name
    this.selectedMaterial = ''
    this.selectedColorKey = null
    this.selectedDump = null
    this.colorDropdownOpen = false
  }

  setCategoryAndMaterial(category: string, material: string): void {
    this.selectedCategory = category
    this.selectedMaterial = material
    this.selectedColorKey = null
    this.selectedDump = null
    this.colorDropdownOpen = false
  }

  setMaterial(name: string): void {
    this.selectedMaterial = name
    this.selectedColorKey = null
    this.selectedDump = null
    this.colorDropdownOpen = false
  }

  selectColor(colorName: string): void {
    const entry = this.colors.find(c => c.name === colorName)
    if (!entry?.dumps.length) return
    this.selectedColorKey = colorName
    this.colorDropdownOpen = false
    this.selectedDump = entry.dumps[0]
  }

  selectFromLibrary(category: string, material: string, color: string, dump: TagDump): void {
    this.selectedCategory = category
    this.selectedMaterial = material
    this.selectedColorKey = color
    this.selectedDump = dump
    this.colorDropdownOpen = false
    this.isWriting = false
    this.writeProgress = null
    this.writeError = null
  }

  nextDump(): void {
    const entry = this.colors.find(c => c.name === this.selectedColorKey)
    if (!entry?.dumps.length) return
    const dumps = entry.dumps
    const idx = dumps.findIndex(d => d.uid === this.selectedDump?.uid)
    this.selectedDump = dumps[idx < 0 ? 0 : (idx + 1) % dumps.length]
  }

  toggleColorDropdown(): void {
    this.colorDropdownOpen = !this.colorDropdownOpen
  }

  closeColorDropdown(): void {
    this.colorDropdownOpen = false
  }

  reset(): void {
    this.selectedCategory = ''
    this.selectedMaterial = ''
    this.selectedColorKey = null
    this.selectedDump = null
    this.colorDropdownOpen = false
    this.isWriting = false
    this.writeProgress = null
    this.writeError = null
  }
}

export const writeStore = new WriteStore()
