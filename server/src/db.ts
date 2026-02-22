import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_PATH = path.join(DATA_DIR, 'lofi-books.db');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

// Ensure directories exist
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cover_image_id TEXT,
    genre TEXT NOT NULL DEFAULT '',
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

// Migrations — add columns to existing tables
try {
  db.exec(`ALTER TABLE timeline_events ADD COLUMN character_ids TEXT NOT NULL DEFAULT '[]'`);
} catch {
  // Column already exists
}

// Migration: add user_id to books and wishlist_items for per-user data isolation
try {
  db.exec(`ALTER TABLE books ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE wishlist_items ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists
}

// Migration: add created_by_name to wishlist_items for shared wishlist display
try {
  db.exec(`ALTER TABLE wishlist_items ADD COLUMN created_by_name TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists
}

export { db, IMAGES_DIR, DATA_DIR };
