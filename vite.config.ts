import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    /**
     * `injectManifest` rather than `generateSW`: the worker is ours (src/sw.ts)
     * and Workbox only supplies the precache list.
     *
     * Offline is not a nicety here. Everything the app does is local, so once
     * the shell is cached there is nothing it needs a network for — and the
     * install is what makes storage durable (spec §3.1).
     */
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Invoice',
        short_name: 'Invoice',
        description: 'Draft, issue and track invoices. Works offline.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#f2f2f3',
        theme_color: '#5980a6',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // pdfmake and its fonts are ~1.8 MB and belong in the precache: an
        // export must work offline like everything else.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
})
