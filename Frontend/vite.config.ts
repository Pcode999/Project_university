import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0', // allow external access
    port: 5173,      // keep your Vite dev port
    allowedHosts: [
      'ec2-3-104-104-235.ap-southeast-2.compute.amazonaws.com'
    ]
  }
})
