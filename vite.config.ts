import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['leaflet', 'react-leaflet', 'react-leaflet-cluster'],
  },
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
})
