import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  const isElectronBuild = process.env.ELECTRON_BUILD === 'true';
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
        '@app': path.resolve(__dirname, 'app'),
        '@features': path.resolve(__dirname, 'features'),
        '@shared': path.resolve(__dirname, 'shared'),
        '@infra': path.resolve(__dirname, 'infra'),
      }
    },
    build: {
      chunkSizeWarningLimit: 750,
      rollupOptions: {
        output: {
          manualChunks: {
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
    envPrefix: ['VITE_', 'TINY_URL_'],
    test: {
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      exclude: ['**/mcp-bridge-server/**'],
    },
  };
});
