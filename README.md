# Bambu NFC

A PWA tool for reading and writing MIFARE Classic 1K NFC tags on Bambu Lab 3D printer filament spools via Bluetooth-connected [Chameleon Ultra](https://github.com/RfidResearchGroup/ChameleonUltra) device.

**🔗 Online: [kuaner.github.io/bambu-nfc](https://kuaner.github.io/bambu-nfc/)**

<p align="center">
  <img src="docs/qr-code.svg" alt="QR Code" width="200"><br>
  <em>Scan to open on your phone</em>
</p>

## Features

- 📖 **Read** — Scan NFC tags, parse filament info (type, color, temperature, diameter, etc.), and match against the tag library
- ✏️ **Write** — Select filament from the library and write to blank NFC tags, with random dump shuffling
- 📱 **PWA** — Install to home screen, works offline, adapts to iOS safe area
- 🔒 **Key Derivation** — Automatically derive read/write keys from UID via HKDF-SHA256

## Tech Stack

- [Svelte 5](https://svelte.dev/) + [Vite](https://vite.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [chameleon-ultra.js](https://github.com/taichunmin/chameleon-ultra.js) — Bluetooth communication SDK
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — Auto-generated Service Worker
- Web Bluetooth API + Web Crypto API

## Development

```bash
npm install
npm run dev      # Start dev server
npm run build    # Production build → dist/
npm run preview  # Preview production build
```

### Regenerate Tag Database

```bash
npm run generate-db
```

## Project Structure

```
src/
  main.ts                  # Entry: mount App.svelte
  app.css                  # Global styles (dark theme)
  App.svelte               # Root component
  lib/
    nfc-parser.ts           # NFC tag dump parser
    nfc.ts                  # Hardware ops: readTag, writeTag, deriveKeys
    i18n/                   # Internationalization
  stores/
    bluetooth.svelte.ts     # Bluetooth connection state
    tag-db.svelte.ts        # Tag database loading & querying
    write.svelte.ts         # Write page cascade selection state
  components/               # UI components
public/
  bambu-tags.json           # Tag database (4.5MB, runtime fetch)
scripts/
  generate-db.ts            # Build script: generate bambu-tags.json from RFID library
docs/
  architecture.md           # App architecture & design system
  nfc-tag-format.md         # Block layout, color encoding, key derivation
  tag-db.md                 # Database structure & regeneration
```

## Acknowledgements

This project depends on the following open-source projects and research:

- [chameleon-ultra.js](https://github.com/taichunmin/chameleon-ultra.js) — JavaScript SDK for Chameleon Ultra device, providing Bluetooth communication and NFC operations
- [Bambu-Lab-RFID-Library](https://github.com/queengooborg/Bambu-Lab-RFID-Library) — Bambu Lab RFID tag dump library, the source of tag data for this project
- [RFID-Tag-Guide](https://github.com/queengooborg/Bambu-Lab-RFID-Library) — Bambu Lab NFC tag format analysis and key derivation documentation

## Disclaimer

This tool is provided as a convenient NFC tag reader and writer for managing and identifying your own filament spools. Use at your own risk. The author is not responsible for any direct or indirect damages resulting from the use of this tool, including but not limited to device damage, filament waste, or print quality issues. Please comply with local laws and regulations.

---

[中文文档](README.zh-CN.md)
