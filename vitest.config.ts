import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Tests live at the repo root, not beside the source they cover.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
