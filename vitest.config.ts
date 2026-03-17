import { defineConfig } from 'vitest/config';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';

// Load env vars in priority order (later overrides earlier):
//   1. .env           (shared defaults)
//   2. .env.local     (developer secrets — put ODDS_API_KEY here)
//   3. .env.test      (test-specific overrides)
// This way developers only need to set keys once in .env.local.
dotenvConfig({ path: path.resolve(process.cwd(), '.env') });
dotenvConfig({ path: path.resolve(process.cwd(), '.env.local') });
dotenvConfig({ path: path.resolve(process.cwd(), '.env.test') });

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
