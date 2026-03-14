import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { execute, initializeDatabase, queryValue, withTransaction } from '../db.js';

type TableName =
  | 'books'
  | 'characters'
  | 'chapters'
  | 'ideas'
  | 'timeline_events'
  | 'wishlist_items'
  | 'connections'
  | 'chapter_illustrations'
  | 'images';

const TABLES: TableName[] = [
  'books',
  'characters',
  'chapters',
  'ideas',
  'timeline_events',
  'wishlist_items',
  'connections',
  'chapter_illustrations',
  'images',
];

const TABLE_COLUMNS: Record<TableName, string[]> = {
  books: ['id', 'title', 'description', 'cover_image_id', 'genre', 'user_id', 'created_at', 'updated_at'],
  characters: ['id', 'book_id', 'name', 'main_image_id', 'backstory', 'development', 'personality_traits', 'relationships', 'special_abilities', 'role', 'sort_order', 'created_at', 'updated_at'],
  chapters: ['id', 'book_id', 'title', 'content', 'sort_order', 'word_count', 'status', 'notes', 'created_at', 'updated_at'],
  ideas: ['id', 'book_id', 'type', 'title', 'description', 'image_id', 'color', 'position_x', 'position_y', 'width', 'height', 'z_index', 'linked_chapter_id', 'created_at', 'updated_at'],
  timeline_events: ['id', 'book_id', 'chapter_id', 'character_ids', 'title', 'description', 'event_type', 'sort_order', 'color', 'created_at', 'updated_at'],
  wishlist_items: ['id', 'title', 'description', 'type', 'status', 'user_id', 'created_by_name', 'created_at', 'updated_at'],
  connections: ['id', 'book_id', 'from_idea_id', 'to_idea_id', 'color', 'created_at', 'updated_at'],
  chapter_illustrations: ['id', 'chapter_id', 'book_id', 'image_id', 'caption', 'sort_order', 'created_at', 'updated_at'],
  images: ['id', 'book_id', 'filename', 'mime_type', 'size', 'created_at'],
};

function parseArgs() {
  const args = process.argv.slice(2);
  let backupDir = '';
  let replace = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--backup-dir') {
      backupDir = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--replace') {
      replace = true;
      continue;
    }
  }

  if (!backupDir) {
    throw new Error('Usage: npm run migrate:sqlite-to-postgres -- --backup-dir /absolute/path/to/backup [--replace]');
  }

  return { backupDir, replace };
}

function countSqliteRows(sqlite: Database.Database, table: TableName): number {
  const row = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return row.count;
}

async function countPostgresRows(table: TableName): Promise<number> {
  return Number(await queryValue(`SELECT COUNT(*)::int AS count FROM ${table}`) || 0);
}

async function main() {
  const { backupDir, replace } = parseArgs();
  const sqlitePath = path.join(backupDir, 'lofi-books.db');

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite backup not found at ${sqlitePath}`);
  }

  await initializeDatabase();

  const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  sqlite.pragma('foreign_keys = ON');

  const sqliteCounts = Object.fromEntries(TABLES.map((table) => [table, countSqliteRows(sqlite, table)])) as Record<TableName, number>;

  const existingRows = await Promise.all(TABLES.map(async (table) => [table, await countPostgresRows(table)] as const));
  const nonEmptyTables = existingRows.filter(([, count]) => count > 0);

  if (nonEmptyTables.length > 0 && !replace) {
    throw new Error(`Target Postgres database is not empty: ${nonEmptyTables.map(([table, count]) => `${table}=${count}`).join(', ')}. Re-run with --replace only after validation.`);
  }

  const rowsByTable = Object.fromEntries(
    TABLES.map((table) => [table, sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]]),
  ) as Record<TableName, Record<string, unknown>[]>;

  await withTransaction(async (client) => {
    if (replace) {
      for (const table of [...TABLES].reverse()) {
        await client.query(`DELETE FROM ${table}`);
      }
    }

    for (const table of TABLES) {
      const columns = TABLE_COLUMNS[table];
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`;
      for (const row of rowsByTable[table]) {
        const values = columns.map((column) => row[column] ?? null);
        await client.query(sql, values);
      }
    }
  });

  const postgresCounts = Object.fromEntries(
    await Promise.all(TABLES.map(async (table) => [table, await countPostgresRows(table)] as const)),
  ) as Record<TableName, number>;

  for (const table of TABLES) {
    if (sqliteCounts[table] !== postgresCounts[table]) {
      throw new Error(`Row count mismatch for ${table}: sqlite=${sqliteCounts[table]} postgres=${postgresCounts[table]}`);
    }
  }

  const summaryPath = path.join(backupDir, 'postgres-import-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    importedAt: new Date().toISOString(),
    sqlitePath,
    sqliteCounts,
    postgresCounts,
  }, null, 2));

  console.log(JSON.stringify({
    ok: true,
    sqlitePath,
    summaryPath,
    counts: postgresCounts,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
