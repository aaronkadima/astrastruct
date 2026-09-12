import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const basePath = process.env.ASTRA_BASE_PATH || '/astrastruct/';

export default defineConfig({
  root: 'app',
  base: basePath,
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2020'
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname)]
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 4173
  }
});
