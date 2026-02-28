import { vi } from 'vitest';
import os from 'os';
import path from 'path';

// This mock intercepts `import { db } from '../db.js'` from route files.
// The path '../db.js' resolves from routes/ to src/db.js.
// For test files in routes/__tests__/, the import '../db.js' in this file
// would resolve to test/db.js which doesn't exist.
// Instead, we use the source import path that the routes use.
vi.mock('../../db.js', () => ({
  get db() { return (globalThis as any).__testDb; },
  get IMAGES_DIR() { return path.join(os.tmpdir(), 'lofi-books-test-data', 'images'); },
  get DATA_DIR() { return path.join(os.tmpdir(), 'lofi-books-test-data'); },
}));
