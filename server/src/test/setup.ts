import { beforeEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { resetTestDb } from './testDb.js';

// Set DATA_DIR to a temp directory BEFORE db.ts tries to mkdir /data
const TEST_DATA_DIR = path.join(os.tmpdir(), 'lofi-books-test-data');
fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(TEST_DATA_DIR, 'images'), { recursive: true });
process.env.DATA_DIR = TEST_DATA_DIR;

// Reset the database before each test by clearing all tables
beforeEach(() => {
  resetTestDb();
});
