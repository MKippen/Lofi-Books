import { defineConfig } from 'vitest/config';
import os from 'os';
import path from 'path';

const testDataDir = path.join(os.tmpdir(), 'lofi-books-test-data');

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    // Set DATA_DIR env var so db.ts doesn't try to create /data
    env: {
      DATA_DIR: testDataDir,
    },
  },
});
