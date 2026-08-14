import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Alias @poker/core на исходники ядра: юнит-тесты app не требуют
// предварительной сборки packages/core (dist/).
export default defineConfig({
  resolve: {
    alias: {
      '@poker/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
