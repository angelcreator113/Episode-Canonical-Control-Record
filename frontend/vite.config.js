import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173
  },
  define: {
    // Set API URLs based on environment
    'import.meta.env.VITE_API_BASE': mode === 'production' 
      ? '""'  // Empty string for production (use relative URLs)
      : '"http://localhost:3002"'  // Localhost for development
  }
}))

