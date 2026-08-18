import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/js/types/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: [
      'src/tests/inspect.test.ts',
      'src/tests/flow.test.ts',
      'src/tests/proof.test.ts',
      'src/tests/homepage-engines.test.ts',
      'src/tests/inspect-privacy.test.ts',
      'src/tests/brand.test.ts',
      'src/tests/sumi-product.test.ts',
      'src/tests/tool-origin.test.ts',
      'src/tests/sentinel.test.ts',
      'src/tests/privacy-finder.test.ts',
      'src/tests/smart-split.test.ts',
      'src/tests/duplicate-finder.test.ts',
      'src/tests/priority-one-originals.test.ts',
      'src/tests/priority-two-originals.test.ts',
      'src/tests/originals-privacy.test.ts',
      'src/tests/original-page-ui.test.ts',
      'src/tests/visual-theme.test.ts',
      'src/tests/current-nav.test.ts',
      'src/tests/workspace.test.ts',
      'src/tests/pages-asset-sharding.test.ts',
      'src/tests/libreoffice-shards.test.ts',
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    pool: 'forks',
    maxWorkers: 1,
  },
});
