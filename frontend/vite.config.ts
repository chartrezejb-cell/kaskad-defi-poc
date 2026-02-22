import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  preview: {
    port: parseInt(process.env.PORT || '4173'),
    host: '0.0.0.0',
    allowedHosts: [
      'kaskad-defi-poc-production.up.railway.app',
      '.railway.app',
      'localhost',
      '127.0.0.1'
    ]
  }
})