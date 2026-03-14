import fs from 'fs';
import path from 'path';
import { Pool, types, type PoolClient, type PoolConfig, type QueryResultRow } from 'pg';

const DATA_DIR = process.env.DATA_DIR || '/data';
const IMAGES_DIR = path.join(DATA_DIR, 'images');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

declare global {
  // Vitest injects an in-memory pg-compatible pool before this module loads.
  // eslint-disable-next-line no-var
  var __LOFI_TEST_POOL: Pool | undefined;
}

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

// Lofi Books can legitimately store millisecond timestamps in ordering fields.
// Parse bigint values back to JS numbers so the API shape stays stable.
types.setTypeParser(20, (value) => Number(value));

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the lofibooks API.');
  }

  const sslMode = (process.env.DATABASE_SSL_MODE
    || (process.env.NODE_ENV === 'production' ? 'require' : 'disable')).toLowerCase();

  const config: PoolConfig = {
    connectionString,
    max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECT_TIMEOUT_MS || '10000', 10),
  };

  if (sslMode !== 'disable') {
    config.ssl = true;
  }

  return new Pool(config);
}

export const db = globalThis.__LOFI_TEST_POOL ?? createPool();

let initializePromise: Promise<void> | null = null;

const SCHEMA_SQL = `
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

  CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
  CREATE INDEX IF NOT EXISTS idx_characters_book_id ON characters(book_id);
  CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);
  CREATE INDEX IF NOT EXISTS idx_ideas_book_id ON ideas(book_id);
  CREATE INDEX IF NOT EXISTS idx_timeline_events_book_id ON timeline_events(book_id);
  CREATE INDEX IF NOT EXISTS idx_connections_book_id ON connections(book_id);
  CREATE INDEX IF NOT EXISTS idx_chapter_illustrations_book_id ON chapter_illustrations(book_id);
  CREATE INDEX IF NOT EXISTS idx_images_book_id ON images(book_id);
  CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id ON wishlist_items(user_id);
`;

export async function initializeDatabase(): Promise<void> {
  if (!initializePromise) {
    initializePromise = (async () => {
      await db.query(SCHEMA_SQL);
      await db.query(`ALTER TABLE characters ALTER COLUMN sort_order TYPE BIGINT USING sort_order::bigint`);
      await db.query(`ALTER TABLE chapters ALTER COLUMN sort_order TYPE BIGINT USING sort_order::bigint`);
      await db.query(`ALTER TABLE chapters ALTER COLUMN word_count TYPE BIGINT USING word_count::bigint`);
      await db.query(`ALTER TABLE ideas ALTER COLUMN z_index TYPE BIGINT USING z_index::bigint`);
      await db.query(`ALTER TABLE timeline_events ALTER COLUMN sort_order TYPE BIGINT USING sort_order::bigint`);
      await db.query(`ALTER TABLE chapter_illustrations ALTER COLUMN sort_order TYPE BIGINT USING sort_order::bigint`);
      await db.query(`ALTER TABLE images ALTER COLUMN size TYPE BIGINT USING size::bigint`);
      await db.query(`ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS character_ids TEXT NOT NULL DEFAULT '[]'`);
      await db.query(`ALTER TABLE books ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT ''`);
      await db.query(`ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT ''`);
      await db.query(`ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS created_by_name TEXT NOT NULL DEFAULT ''`);
    })();
  }

  await initializePromise;
}

export async function closeDatabase(): Promise<void> {
  await db.end();
}

export async function queryRows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  executor: Queryable = db,
): Promise<T[]> {
  const result = await executor.query<T>(text, params);
  return result.rows;
}

export async function queryRow<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  executor: Queryable = db,
): Promise<T | null> {
  const rows = await queryRows<T>(text, params, executor);
  return rows[0] ?? null;
}

export async function queryValue<T = unknown>(
  text: string,
  params: unknown[] = [],
  executor: Queryable = db,
): Promise<T | null> {
  const row = await queryRow<Record<string, T>>(text, params, executor);
  if (!row) return null;
  const firstKey = Object.keys(row)[0];
  return firstKey ? row[firstKey] : null;
}

export async function execute(
  text: string,
  params: unknown[] = [],
  executor: Queryable = db,
): Promise<void> {
  await executor.query(text, params);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
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

export function placeholders(count: number, startAt = 1): string {
  return Array.from({ length: count }, (_unused, index) => `$${index + startAt}`).join(', ');
}

export { DATA_DIR, IMAGES_DIR };
