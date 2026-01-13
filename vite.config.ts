import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  const isElectronBuild = process.env.ELECTRON_BUILD === 'true' || command === 'build';
  return {
    base: isElectronBuild ? './' : '/',
    server: {
      port: 3000,
      host: '0.0.0.0',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      proxy: {
        '/api/merge': {
          target: 'http://localhost:5001',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
        '/api/excel-tools': {
          target: 'http://localhost:5001',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/excel-tools/, ''),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 750, // Increase from default 500kB
      rollupOptions: {
        output: {
          manualChunks: {
            // Split large vendor libraries into separate chunks
            'vendor-react': ['react', 'react-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-pdf': ['jspdf', 'jspdf-autotable'],
            'vendor-excel': ['xlsx'],
            'vendor-charts': ['recharts'],
            'vendor-utils': ['dompurify', 'html2canvas'],
          }
        }
      }
    },
    envPrefix: ['VITE_', 'TINY_URL_']
  };
});
