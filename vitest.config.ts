import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'scripts'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve('.'),
    },
  },
});
