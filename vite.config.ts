import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
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
    }
  };
});
