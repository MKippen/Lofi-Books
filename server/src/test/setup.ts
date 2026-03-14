import { beforeAll, beforeEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { pool, resetTestDb } from './testDb.js';

const TEST_DATA_DIR = path.join(os.tmpdir(), 'lofi-books-test-data');
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(TEST_DATA_DIR, 'images'), { recursive: true });
process.env.DATA_DIR = TEST_DATA_DIR;
(globalThis as any).__LOFI_TEST_POOL = pool;

beforeAll(async () => {
  const { initializeDatabase } = await import('../db.js');
  await initializeDatabase();
});

beforeEach(() => {
  resetTestDb();
});
