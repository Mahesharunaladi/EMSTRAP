import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: resolve(process.cwd(), 'driver'),
  publicDir: resolve(process.cwd(), 'public'),
  cacheDir: resolve(process.cwd(), 'node_modules/.vite-driver'),
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
    fs: { allow: [resolve(process.cwd())] },
  },
})
