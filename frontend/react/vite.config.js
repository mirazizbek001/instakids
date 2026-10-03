import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Lokal ishlash: backend http://127.0.0.1:8000 da. Boshqa joyda bo'lsa: BACKEND_URL=... npm run dev
const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8000'
const buildId = Date.now().toString()

const buildVersionPlugin = {
  name: 'build-version',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId }) })
  },
}

export default defineConfig({
  base: '/',
  plugins: [react(), buildVersionPlugin],
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/plat': backend,
      '/media': backend,
    },
  },
})
