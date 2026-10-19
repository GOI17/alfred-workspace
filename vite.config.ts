import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'src/renderer',
  plugins: [react()],
  server: {
    allowedHosts: ['alfredworkspace.alfredlabs.org'],
  },
  build: { outDir: resolve('dist/client'), emptyOutDir: true },
})
