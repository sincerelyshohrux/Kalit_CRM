import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Backend (Django) bilan bir xil origin orqali ishlash uchun proxy:
// refresh-token httpOnly cookie'si SameSite=Strict bo'lgani uchun shu kerak.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
})
