import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/bambu-nfc/' : '/',
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.svelte.ts', '.jsx', '.tsx', '.json']
  },
  plugins: [
    tailwindcss(),
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        globIgnores: ['**/bambu-tags.json'],
        runtimeCaching: [
          {
            urlPattern: /\/bambu-tags\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bambu-nfc-tags',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 1 }
            }
          },
          {
            urlPattern: /^https?.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bambu-nfc-v2',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50 }
            }
          }
        ]
      },
      manifest: {
        name: 'Bambu NFC Writer',
        short_name: 'Bambu NFC',
        description: 'Write & read Bambu Lab NFC tags via Chameleon Ultra',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f1117',
        theme_color: '#4f8cff',
        orientation: 'portrait',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
