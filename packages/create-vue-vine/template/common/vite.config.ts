import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { VineVitePlugin } from 'vue-vine/vite'

export default defineConfig({
  plugins: [
    VineVitePlugin(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
