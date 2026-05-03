import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Vitest config — separate from vite.config.js so the test runner can pick it up
// without dragging in dev-server-only settings (HMR, proxy, etc.).
// Resolve aliases mirror vite.config.js to keep a single React instance.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'react/jsx-runtime': path.resolve('./node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve('./node_modules/react/jsx-dev-runtime'),
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
