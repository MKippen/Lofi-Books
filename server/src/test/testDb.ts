import Database, { type Database as DatabaseType } from 'better-sqlite3';
import os from 'os';
import path from 'path';

const TEST_DATA_DIR = path.join(os.tmpdir(), 'lofi-books-test-data');

// Single in-memory database for the entire test suite
// We clear tables between tests instead of creating a new db,
// because ESM `import { db }` captures the reference at import time.
const db: DatabaseType = new Database(':memory:');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cover_image_id TEXT,
    genre TEXT NOT NULL DEFAULT '',
    user_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    main_image_id TEXT,
    backstory TEXT NOT NULL DEFAULT '',
    development TEXT NOT NULL DEFAULT '',
    personality_traits TEXT NOT NULL DEFAULT '[]',
    relationships TEXT NOT NULL DEFAULT '[]',
    special_abilities TEXT NOT NULL DEFAULT '[]',
    role TEXT NOT NULL DEFAULT 'supporting',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'note',
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    image_id TEXT,
    color TEXT NOT NULL DEFAULT 'sakura-white',
    position_x REAL NOT NULL DEFAULT 100,
    position_y REAL NOT NULL DEFAULT 100,
    width REAL NOT NULL DEFAULT 220,
    height REAL NOT NULL DEFAULT 180,
    z_index INTEGER NOT NULL DEFAULT 0,
    linked_chapter_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS timeline_events (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_id TEXT,
    character_ids TEXT NOT NULL DEFAULT '[]',
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    event_type TEXT NOT NULL DEFAULT 'plot',
    sort_order INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wishlist_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'idea',
    status TEXT NOT NULL DEFAULT 'open',
    user_id TEXT NOT NULL DEFAULT '',
    created_by_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    from_idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    to_idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    color TEXT NOT NULL DEFAULT 'red',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chapter_illustrations (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    image_id TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export function resetTestDb() {
  // Disable FK checks temporarily so we can delete in any order
  db.pragma('foreign_keys = OFF');
  db.exec(`
    DELETE FROM images;
    DELETE FROM chapter_illustrations;
    DELETE FROM connections;
    DELETE FROM timeline_events;
    DELETE FROM ideas;
    DELETE FROM chapters;
    DELETE FROM characters;
    DELETE FROM wishlist_items;
    DELETE FROM books;
  `);
  db.pragma('foreign_keys = ON');
}

const IMAGES_DIR = path.join(TEST_DATA_DIR, 'images');
const DATA_DIR = TEST_DATA_DIR;

export { db, IMAGES_DIR, DATA_DIR };
