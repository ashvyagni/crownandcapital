import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: '0.0.0.0', forwardConsole: false, proxy: { '/ws': { target: process.env.CROWN_SERVER_URL ?? 'ws://127.0.0.1:2567', ws: true } } },
})
