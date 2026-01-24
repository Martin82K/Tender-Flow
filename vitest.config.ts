import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['**/mcp-bridge-server/**'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
});
