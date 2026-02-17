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
            // Split large vendor chunks to reduce memory
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['react-beautiful-dnd', 'konva', 'react-konva'],
          }
        }
      }
    }
    // Environment variables are automatically loaded from .env files
    // No need to override them here
  }
})

