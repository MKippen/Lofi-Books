import { newDb } from 'pg-mem';
import os from 'os';
import path from 'path';
import type { PoolClient, QueryResultRow } from 'pg';

const mem = newDb({
  autoCreateForeignKeyIndices: true,
});

const adapter = mem.adapters.createPg();
const pool = new adapter.Pool();
const DATA_DIR = path.join(os.tmpdir(), 'lofi-books-test-data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

mem.public.none(`
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
    sort_order BIGINT NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    sort_order BIGINT NOT NULL DEFAULT 0,
    word_count BIGINT NOT NULL DEFAULT 0,
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
    position_x DOUBLE PRECISION NOT NULL DEFAULT 100,
    position_y DOUBLE PRECISION NOT NULL DEFAULT 100,
    width DOUBLE PRECISION NOT NULL DEFAULT 220,
    height DOUBLE PRECISION NOT NULL DEFAULT 180,
    z_index BIGINT NOT NULL DEFAULT 0,
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
    sort_order BIGINT NOT NULL DEFAULT 0,
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
    sort_order BIGINT NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size BIGINT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

function resetTestDb() {
  mem.public.none(`
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
}

async function queryRows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  executor: Pick<typeof pool, 'query'> | Pick<PoolClient, 'query'> = pool,
): Promise<T[]> {
  const result = await executor.query(text, params);
  return result.rows as T[];
}

async function queryRow<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  executor: Pick<typeof pool, 'query'> | Pick<PoolClient, 'query'> = pool,
): Promise<T | null> {
  const rows = await queryRows<T>(text, params, executor);
  return rows[0] ?? null;
}

async function queryValue<T = unknown>(
  text: string,
  params: unknown[] = [],
  executor: Pick<typeof pool, 'query'> | Pick<PoolClient, 'query'> = pool,
): Promise<T | null> {
  const row = await queryRow<Record<string, T>>(text, params, executor);
  if (!row) return null;
  const firstKey = Object.keys(row)[0];
  return firstKey ? row[firstKey] : null;
}

async function execute(
  text: string,
  params: unknown[] = [],
  executor: Pick<typeof pool, 'query'> | Pick<PoolClient, 'query'> = pool,
): Promise<void> {
  await executor.query(text, params);
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function placeholders(count: number, startAt = 1): string {
  return Array.from({ length: count }, (_unused, index) => `$${index + startAt}`).join(', ');
}

async function initializeDatabase() {
  // Schema is created eagerly above.
}

async function closeDatabase() {
  await pool.end();
}

export {
  pool,
  pool as db,
  DATA_DIR,
  IMAGES_DIR,
  closeDatabase,
  execute,
  initializeDatabase,
  placeholders,
  queryRow,
  queryRows,
  queryValue,
  resetTestDb,
  withTransaction,
};
