import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        // Force single React instance
        react: path.resolve('./node_modules/react'),
        'react-dom': path.resolve('./node_modules/react-dom')
      }
    },
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3002',
          changeOrigin: true,
          secure: false
        },
        '/s3-proxy': {
          target: 'https://episode-metadata-storage-dev.s3.amazonaws.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/s3-proxy/, '')
        }
      }
    },
    build: {
      // Reduce memory usage during build
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React - always needed
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // Heavy visualization libs - only when needed
            'canvas-vendor': ['konva', 'react-konva', 'html2canvas'],
            // Rich text & charting
            'editor-vendor': ['react-quill', 'recharts'],
            // DnD libraries
            'dnd-vendor': ['react-beautiful-dnd', '@dnd-kit/core', '@dnd-kit/sortable'],
            // PDF generation
            'pdf-vendor': ['jspdf'],
          }
        }
      }
    }
    // Environment variables are automatically loaded from .env files
    // No need to override them here
  }
})

