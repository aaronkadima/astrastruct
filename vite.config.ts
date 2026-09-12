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
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll('\\', '/');
          if (normalized.includes('/node_modules/react/') || normalized.includes('/node_modules/react-dom/')) return 'react-vendor';
          if (normalized.includes('/web/src/solver/')) return 'structural-solver';
          if (
            normalized.includes('/app/src/AnalysisPanelV13') ||
            normalized.includes('/app/src/EngineeringPanels') ||
            normalized.includes('/app/src/NonlinearPostprocessPanel') ||
            normalized.includes('/app/src/NonlinearReportPanel') ||
            normalized.includes('/app/src/DynamicsPostprocessPanel') ||
            normalized.includes('/app/src/BucklingPanel')
          ) return 'engineering-panels';
          return undefined;
        }
      }
    }
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
