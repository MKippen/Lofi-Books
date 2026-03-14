import { Router } from 'express';
import { DATA_DIR, execute, IMAGES_DIR, placeholders, queryRows, queryValue, withTransaction } from '../db.js';
import { asyncHandler } from '../http.js';
import fs from 'fs';
import path from 'path';
import type { PoolClient } from 'pg';

export const backupRouter = Router();

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const BACKUP_FOLDER = 'Lofi Books';
const MAX_BACKUPS = 30;
const MUTATION_DEBOUNCE_MS = 30_000;

interface BackupFileSummary {
  name: string;
  size: number;
  lastModified: string;
  isLatest: boolean;
}

interface BackupMetadata {
  timestamp: string;
  version: number;
  bookCount: number;
  totalRecords: number;
  imageCount?: number;
}

interface ImageRow {
  id: string;
  book_id: string;
  filename: string;
  mime_type: string;
  size: number;
  created_at: string;
}

interface BackupPayload {
  books: Record<string, unknown>[];
  characters: Record<string, unknown>[];
  chapters: Record<string, unknown>[];
  ideas: Record<string, unknown>[];
  connections: Record<string, unknown>[];
  chapterIllustrations: Record<string, unknown>[];
  timelineEvents: Record<string, unknown>[];
  wishlistItems: Record<string, unknown>[];
  images: Record<string, unknown>[];
}

interface BackupSessionState {
  lastBackupTime: string | null;
  lastBackupError: string | null;
  backupInProgress: boolean;
  accessToken: string | null;
  lastUserId: string | null;
  mutationDebounceTimer: ReturnType<typeof setTimeout> | null;
}

const backupSessions = new Map<string, BackupSessionState>();

function getBackupPrincipal(req: { userEmail?: string; userId?: string }): string {
  const email = (req.userEmail || '').trim().toLowerCase();
  if (email) return email;
  return (req.userId || '').trim();
}

function getBackupSession(principal: string): BackupSessionState {
  let session = backupSessions.get(principal);
  if (!session) {
    session = {
      lastBackupTime: null,
      lastBackupError: null,
      backupInProgress: false,
      accessToken: null,
      lastUserId: null,
      mutationDebounceTimer: null,
    };
    backupSessions.set(principal, session);
  }
  return session;
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
}

function toSnakeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    if (Array.isArray(value) || (value !== null && typeof value === 'object' && !(value instanceof Date))) {
      result[snakeKey] = JSON.stringify(value);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

backupRouter.get('/status', (req, res) => {
  const principal = getBackupPrincipal(req as any);
  const session = principal ? getBackupSession(principal) : null;
  res.json({
    lastBackupTime: session?.lastBackupTime ?? null,
    lastBackupError: session?.lastBackupError ?? null,
    backupInProgress: session?.backupInProgress ?? false,
    isConnected: session?.accessToken !== null,
  });
});

backupRouter.get('/has-data', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  const count = Number(await queryValue('SELECT COUNT(*)::int AS count FROM books WHERE user_id = $1', [userId]) || 0);
  res.json({ hasData: count > 0, bookCount: count });
}));

backupRouter.get('/remote-meta', asyncHandler(async (req, res) => {
  const principal = getBackupPrincipal(req as any);
  const session = principal ? getBackupSession(principal) : null;
  if (!session?.accessToken) return res.json(null);

  try {
    const metadata = await getRemoteMetadata(session.accessToken);
    res.json(metadata);
  } catch {
    res.json(null);
  }
}));

backupRouter.post('/token', (req, res) => {
  const principal = getBackupPrincipal(req as any);
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'Missing accessToken' });
  if (!principal) return res.status(400).json({ error: 'Missing authenticated user' });

  const session = getBackupSession(principal);
  session.accessToken = accessToken;
  session.lastUserId = (req as any).userId as string || '';
  res.json({ ok: true });
});

backupRouter.post('/trigger', asyncHandler(async (req, res) => {
  const principal = getBackupPrincipal(req as any);
  const session = principal ? getBackupSession(principal) : null;
  const token = req.body.accessToken || session?.accessToken;
  if (!token) return res.status(400).json({ error: 'No access token available' });
  if (!session) return res.status(400).json({ error: 'Missing authenticated user' });
  if (session.backupInProgress) return res.json({ ok: true, message: 'Backup already in progress' });

  try {
    const userId = (req as any).userId as string || '';
    session.backupInProgress = true;
    session.accessToken = token;
    session.lastUserId = userId;
    await performBackup(session, token, userId);
    res.json({ ok: true, lastBackupTime: session.lastBackupTime });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    session.lastBackupError = msg;
    res.status(500).json({ error: msg });
  } finally {
    session.backupInProgress = false;
  }
}));

backupRouter.post('/notify-mutation', (req, res) => {
  const principal = getBackupPrincipal(req as any);
  const session = principal ? getBackupSession(principal) : null;

  if (!session?.accessToken) {
    return res.json({ ok: true, message: 'No token, skipping' });
  }

  const userId = (req as any).userId as string || session.lastUserId || '';

  if (session.mutationDebounceTimer) clearTimeout(session.mutationDebounceTimer);

  session.mutationDebounceTimer = setTimeout(async () => {
    if (session.accessToken && !session.backupInProgress) {
      try {
        session.backupInProgress = true;
        await performBackup(session, session.accessToken, userId);
        console.log('Mutation-triggered backup completed at', session.lastBackupTime);
      } catch (err) {
        console.error('Mutation-triggered backup failed:', err);
        session.lastBackupError = err instanceof Error ? err.message : String(err);
      } finally {
        session.backupInProgress = false;
      }
    }
  }, MUTATION_DEBOUNCE_MS);

  res.json({ ok: true });
});

backupRouter.get('/list', asyncHandler(async (req, res) => {
  const principal = getBackupPrincipal(req as any);
  const session = principal ? getBackupSession(principal) : null;
  if (!session?.accessToken) return res.json([]);
  try {
    res.json(await listBackupFiles(session.accessToken));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}));

backupRouter.post('/import-local', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  if (!userId) return res.status(400).json({ error: 'No user ID' });

  const data = normalizeBackupPayload(req.body);

  console.log('Import-local: importing data for user', userId, '—', summarizePayload(data));

  try {
    await importAllData(data, userId);
    const result = summarizeResult(data);
    console.log('Import-local: success', result);
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Import-local: failed —', msg);
    res.status(500).json({ error: msg });
  }
}));

backupRouter.post('/restore', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  const principal = getBackupPrincipal(req as any);
  const session = principal ? getBackupSession(principal) : null;
  const token = req.body.accessToken || session?.accessToken;
  if (!token) return res.status(400).json({ error: 'No access token available' });
  if (!session) return res.status(400).json({ error: 'Missing authenticated user' });

  const availableBackups = await listBackupFiles(token);
  const filename = req.body.filename || choosePreferredRestoreFile(availableBackups);

  if (!filename) {
    return res.status(404).json({ error: 'No restore points available' });
  }

  if (!availableBackups.some((backup) => backup.name === filename)) {
    return res.status(400).json({ error: 'Requested backup file was not found on OneDrive' });
  }

  try {
    const response = await graphFetch(token, `/me/drive/root:/${BACKUP_FOLDER}/${filename}:/content`);
    const data = normalizeBackupPayload(await response.json());

    console.log('Restore: importing data for user', userId, '—', summarizePayload(data));

    await importAllData(data, userId);

    let imagesRestored = 0;
    try {
      imagesRestored = await restoreImagesFromOneDrive(token, data.images as unknown as ImageRow[]);
      if (imagesRestored > 0) {
        console.log(`[restore] Restored ${imagesRestored} image file(s) from OneDrive`);
      }
    } catch (imgErr) {
      console.warn('[restore] Image restore failed (data is safe):', imgErr instanceof Error ? imgErr.message : imgErr);
    }

    session.accessToken = token;
    session.lastBackupTime = new Date().toISOString();
    session.lastBackupError = null;

    const result = { ok: true, ...summarizeResult(data), imagesRestored };
    console.log('Restore: success', result);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Restore: failed —', msg);
    res.status(500).json({ error: msg });
  }
}));

async function performBackup(session: BackupSessionState, accessToken: string, userId = '') {
  const data = userId ? await exportUserData(userId) : await exportAllData();
  await ensureSafeBackupTarget(accessToken, data);
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });

  await ensureBackupFolder(accessToken);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const timestampedName = `backup-${timestamp}.json`;

  await Promise.all([
    uploadFile(accessToken, 'latest-backup.json', blob),
    uploadFile(accessToken, timestampedName, blob),
  ]);

  const imageCount = await syncImagesToOneDrive(accessToken, data.images as unknown as ImageRow[]);
  if (imageCount > 0) {
    console.log(`[backup] Synced ${imageCount} image(s) to OneDrive`);
  }

  const metadata: BackupMetadata = {
    timestamp: new Date().toISOString(),
    version: 3,
    bookCount: data.books.length,
    totalRecords: data.books.length + data.characters.length + data.chapters.length
      + data.ideas.length + data.timelineEvents.length + data.wishlistItems.length,
    imageCount: data.images.length,
  };

  await uploadFile(accessToken, 'backup-meta.json', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

  session.lastBackupTime = new Date().toISOString();
  session.lastBackupError = null;

  try {
    await rotateBackups(accessToken);
  } catch (err) {
    console.warn('Backup rotation failed:', err);
  }
}

async function ensureSafeBackupTarget(accessToken: string, data: BackupPayload) {
  const nextBookCount = data.books.length;
  const nextTotalRecords = data.books.length + data.characters.length + data.chapters.length
    + data.ideas.length + data.timelineEvents.length + data.wishlistItems.length;

  if (nextBookCount > 0 || nextTotalRecords > 0) return;

  try {
    const remoteMetadata = await getRemoteMetadata(accessToken);
    if (remoteMetadata && (remoteMetadata.bookCount > 0 || remoteMetadata.totalRecords > 0)) {
      throw new Error(
        'Refusing to overwrite an existing non-empty OneDrive backup with an empty backup. Restore or investigate before backing up again.',
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Refusing to overwrite')) {
      throw err;
    }
  }
}

async function getRemoteMetadata(accessToken: string): Promise<BackupMetadata | null> {
  try {
    const response = await graphFetch(accessToken, `/me/drive/root:/${BACKUP_FOLDER}/backup-meta.json:/content`);
    return await response.json() as BackupMetadata;
  } catch {
    return null;
  }
}

async function listBackupFiles(accessToken: string): Promise<BackupFileSummary[]> {
  const response = await graphFetch(
    accessToken,
    `/me/drive/root:/${BACKUP_FOLDER}:/children?$orderby=lastModifiedDateTime desc`,
  );
  const data = await response.json();
  interface DriveItem { name: string; size: number; lastModifiedDateTime: string }
  const files = data.value as DriveItem[];

  return files
    .filter((item) => item.name === 'latest-backup.json'
      || (item.name.startsWith('backup-') && item.name.endsWith('.json') && item.name !== 'backup-meta.json'))
    .map((item) => ({
      name: item.name,
      size: item.size,
      lastModified: item.lastModifiedDateTime,
      isLatest: item.name === 'latest-backup.json',
    }))
    .sort((left, right) => {
      if (left.isLatest !== right.isLatest) return left.isLatest ? -1 : 1;
      return right.lastModified.localeCompare(left.lastModified);
    });
}

function choosePreferredRestoreFile(backups: BackupFileSummary[]): string | null {
  if (backups.length === 0) return null;
  const latestTimestampedBackup = backups.find((backup) => !backup.isLatest);
  return latestTimestampedBackup?.name ?? backups[0]?.name ?? null;
}

async function exportAllData(): Promise<BackupPayload> {
  return {
    books: await queryRows('SELECT * FROM books'),
    characters: await queryRows('SELECT * FROM characters'),
    chapters: await queryRows('SELECT * FROM chapters'),
    ideas: await queryRows('SELECT * FROM ideas'),
    connections: await queryRows('SELECT * FROM connections'),
    chapterIllustrations: await queryRows('SELECT * FROM chapter_illustrations'),
    timelineEvents: await queryRows('SELECT * FROM timeline_events'),
    wishlistItems: await queryRows('SELECT * FROM wishlist_items'),
    images: await queryRows('SELECT * FROM images'),
  };
}

async function exportUserData(userId: string): Promise<BackupPayload> {
  const bookIds = (await queryRows<{ id: string }>('SELECT id FROM books WHERE user_id = $1', [userId])).map((row) => row.id);

  if (bookIds.length === 0) {
    return {
      books: [],
      characters: [],
      chapters: [],
      ideas: [],
      connections: [],
      chapterIllustrations: [],
      timelineEvents: [],
      wishlistItems: await queryRows('SELECT * FROM wishlist_items WHERE user_id = $1', [userId]),
      images: [],
    };
  }

  return {
    books: await queryRows('SELECT * FROM books WHERE user_id = $1', [userId]),
    characters: await selectByBookIds('characters', bookIds),
    chapters: await selectByBookIds('chapters', bookIds),
    ideas: await selectByBookIds('ideas', bookIds),
    connections: await selectByBookIds('connections', bookIds),
    chapterIllustrations: await selectByBookIds('chapter_illustrations', bookIds),
    timelineEvents: await selectByBookIds('timeline_events', bookIds),
    wishlistItems: await queryRows('SELECT * FROM wishlist_items WHERE user_id = $1', [userId]),
    images: await selectByBookIds('images', bookIds),
  };
}

async function selectByBookIds(table: string, bookIds: string[]) {
  return queryRows(`SELECT * FROM ${table} WHERE book_id IN (${placeholders(bookIds.length)})`, bookIds);
}

async function importAllData(data: BackupPayload, userId: string) {
  await withTransaction(async (client) => {
    const existingBookIds = (await queryRows<{ id: string }>(
      'SELECT id FROM books WHERE user_id = $1',
      [userId],
      client,
    )).map((row) => row.id);

    if (existingBookIds.length > 0) {
      await deleteForBookIds('images', existingBookIds, client);
      await deleteForBookIds('chapter_illustrations', existingBookIds, client);
      await deleteForBookIds('connections', existingBookIds, client);
      await deleteForBookIds('timeline_events', existingBookIds, client);
      await deleteForBookIds('ideas', existingBookIds, client);
      await deleteForBookIds('chapters', existingBookIds, client);
      await deleteForBookIds('characters', existingBookIds, client);
    }

    await execute('DELETE FROM books WHERE user_id = $1', [userId], client);
    await execute('DELETE FROM wishlist_items WHERE user_id = $1', [userId], client);

    const normalize = (rows: unknown[]) => rows.map((row) => toSnakeKeys(row as Record<string, unknown>));

    for (const row of normalize(data.books)) {
      await insertBook(row, userId, client);
    }
    for (const row of normalize(data.characters)) {
      await insertNamedRow(client,
        'INSERT INTO characters (id, book_id, name, main_image_id, backstory, development, personality_traits, relationships, special_abilities, role, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
        ['id', 'book_id', 'name', 'main_image_id', 'backstory', 'development', 'personality_traits', 'relationships', 'special_abilities', 'role', 'sort_order', 'created_at', 'updated_at'],
        row,
      );
    }
    for (const row of normalize(data.chapters)) {
      await insertNamedRow(client,
        'INSERT INTO chapters (id, book_id, title, content, sort_order, word_count, status, notes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        ['id', 'book_id', 'title', 'content', 'sort_order', 'word_count', 'status', 'notes', 'created_at', 'updated_at'],
        row,
      );
    }
    for (const row of normalize(data.ideas)) {
      await insertNamedRow(client,
        'INSERT INTO ideas (id, book_id, type, title, description, image_id, color, position_x, position_y, width, height, z_index, linked_chapter_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
        ['id', 'book_id', 'type', 'title', 'description', 'image_id', 'color', 'position_x', 'position_y', 'width', 'height', 'z_index', 'linked_chapter_id', 'created_at', 'updated_at'],
        row,
      );
    }
    for (const row of normalize(data.connections)) {
      await insertNamedRow(client,
        'INSERT INTO connections (id, book_id, from_idea_id, to_idea_id, color, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        ['id', 'book_id', 'from_idea_id', 'to_idea_id', 'color', 'created_at', 'updated_at'],
        row,
      );
    }
    for (const row of normalize(data.chapterIllustrations)) {
      await insertNamedRow(client,
        'INSERT INTO chapter_illustrations (id, chapter_id, book_id, image_id, caption, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        ['id', 'chapter_id', 'book_id', 'image_id', 'caption', 'sort_order', 'created_at', 'updated_at'],
        row,
      );
    }
    for (const row of normalize(data.timelineEvents)) {
      if (!row.character_ids) row.character_ids = '[]';
      await insertNamedRow(client,
        'INSERT INTO timeline_events (id, book_id, chapter_id, character_ids, title, description, event_type, sort_order, color, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        ['id', 'book_id', 'chapter_id', 'character_ids', 'title', 'description', 'event_type', 'sort_order', 'color', 'created_at', 'updated_at'],
        row,
      );
    }
    for (const row of normalize(data.wishlistItems)) {
      row.user_id = userId;
      if (!row.created_by_name) row.created_by_name = '';
      await insertNamedRow(client,
        'INSERT INTO wishlist_items (id, title, description, type, status, user_id, created_by_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        ['id', 'title', 'description', 'type', 'status', 'user_id', 'created_by_name', 'created_at', 'updated_at'],
        row,
      );
    }
    for (const row of normalize(data.images)) {
      await insertNamedRow(client,
        'INSERT INTO images (id, book_id, filename, mime_type, size, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        ['id', 'book_id', 'filename', 'mime_type', 'size', 'created_at'],
        row,
      );
    }
  });
}

async function insertBook(row: Record<string, unknown>, userId: string, client: PoolClient) {
  row.user_id = userId;
  await insertNamedRow(
    client,
    'INSERT INTO books (id, title, description, cover_image_id, genre, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    ['id', 'title', 'description', 'cover_image_id', 'genre', 'user_id', 'created_at', 'updated_at'],
    row,
  );
}

async function insertNamedRow(
  client: PoolClient,
  sql: string,
  columns: string[],
  row: Record<string, unknown>,
) {
  const values = columns.map((column) => row[column] ?? defaultValueForColumn(column));
  await client.query(sql, values);
}

function defaultValueForColumn(column: string): unknown {
  switch (column) {
    case 'description':
    case 'genre':
    case 'content':
    case 'notes':
    case 'title':
    case 'backstory':
    case 'development':
    case 'caption':
    case 'filename':
    case 'mime_type':
    case 'created_by_name':
    case 'color':
    case 'event_type':
    case 'status':
    case 'type':
      return '';
    case 'personality_traits':
    case 'relationships':
    case 'special_abilities':
    case 'character_ids':
      return '[]';
    case 'sort_order':
    case 'word_count':
    case 'size':
    case 'z_index':
      return 0;
    case 'width':
      return 220;
    case 'height':
      return 180;
    case 'position_x':
    case 'position_y':
      return 100;
    default:
      return null;
  }
}

async function deleteForBookIds(table: string, bookIds: string[], client: PoolClient) {
  await execute(`DELETE FROM ${table} WHERE book_id IN (${placeholders(bookIds.length)})`, bookIds, client);
}

function normalizeBackupPayload(raw: unknown): BackupPayload {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const requiredKeys = ['books', 'characters', 'chapters', 'ideas', 'timelineEvents', 'wishlistItems', 'images'];

  for (const key of requiredKeys) {
    if (!Array.isArray(data[key])) {
      throw new Error(`Invalid backup: missing ${key}`);
    }
  }

  return {
    books: data.books as Record<string, unknown>[],
    characters: data.characters as Record<string, unknown>[],
    chapters: data.chapters as Record<string, unknown>[],
    ideas: data.ideas as Record<string, unknown>[],
    connections: Array.isArray(data.connections) ? data.connections as Record<string, unknown>[] : [],
    chapterIllustrations: Array.isArray(data.chapterIllustrations) ? data.chapterIllustrations as Record<string, unknown>[] : [],
    timelineEvents: data.timelineEvents as Record<string, unknown>[],
    wishlistItems: data.wishlistItems as Record<string, unknown>[],
    images: data.images as Record<string, unknown>[],
  };
}

function summarizePayload(data: BackupPayload) {
  return {
    books: data.books.length,
    characters: data.characters.length,
    chapters: data.chapters.length,
    ideas: data.ideas.length,
    timelineEvents: data.timelineEvents.length,
    wishlistItems: data.wishlistItems.length,
    images: data.images.length,
  };
}

function summarizeResult(data: BackupPayload) {
  return {
    bookCount: data.books.length,
    totalRecords: data.books.length + data.characters.length
      + data.chapters.length + data.ideas.length
      + data.timelineEvents.length + data.wishlistItems.length,
  };
}

const IMAGES_FOLDER = `${BACKUP_FOLDER}/images`;

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/svg+xml': 'svg',
  };
  return map[mime] || 'bin';
}

async function syncImagesToOneDrive(accessToken: string, images: ImageRow[]): Promise<number> {
  if (images.length === 0) return 0;

  await ensureImagesFolder(accessToken);

  let existingFiles: Set<string> = new Set();
  try {
    const response = await graphFetch(
      accessToken,
      `/me/drive/root:/${IMAGES_FOLDER}:/children?$select=name&$top=200`,
    );
    const data = await response.json();
    existingFiles = new Set((data.value as { name: string }[]).map((file) => file.name));
  } catch {
    existingFiles = new Set();
  }

  let uploaded = 0;
  for (const img of images) {
    const ext = extFromMime(img.mime_type);
    const oneDriveFilename = `${img.id}.${ext}`;
    if (existingFiles.has(oneDriveFilename)) continue;

    const localPath = path.join(IMAGES_DIR, oneDriveFilename);
    if (!fs.existsSync(localPath)) {
      console.warn(`[backup] Image file missing locally: ${localPath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(localPath);
    const blob = new Blob([fileBuffer], { type: img.mime_type });
    const uploadPath = `/me/drive/root:/${IMAGES_FOLDER}/${oneDriveFilename}:/content`;

    if (blob.size < 4 * 1024 * 1024) {
      await graphFetch(accessToken, uploadPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: blob,
      });
    } else {
      const sessionResponse = await graphFetch(
        accessToken,
        `/me/drive/root:/${IMAGES_FOLDER}/${oneDriveFilename}:/createUploadSession`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
        },
      );
      const { uploadUrl } = await sessionResponse.json();
      await uploadLargeBlob(uploadUrl, blob);
    }

    uploaded++;
    console.log(`[backup] Uploaded image: ${oneDriveFilename} (${(blob.size / 1024).toFixed(0)}KB)`);
  }

  return uploaded;
}

async function restoreImagesFromOneDrive(accessToken: string, images: ImageRow[]): Promise<number> {
  if (images.length === 0) return 0;

  let restored = 0;
  for (const img of images) {
    const ext = extFromMime(img.mime_type);
    const filename = `${img.id}.${ext}`;
    const localPath = path.join(IMAGES_DIR, filename);
    if (fs.existsSync(localPath)) continue;

    try {
      const response = await graphFetch(accessToken, `/me/drive/root:/${IMAGES_FOLDER}/${filename}:/content`);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
      restored++;
      console.log(`[restore] Downloaded image: ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
    } catch (err) {
      console.warn(`[restore] Could not download image ${filename}:`, err instanceof Error ? err.message : err);
    }
  }

  return restored;
}

async function ensureImagesFolder(accessToken: string) {
  try {
    await graphFetch(accessToken, `/me/drive/root:/${IMAGES_FOLDER}`);
  } catch {
    await graphFetch(accessToken, `/me/drive/root:/${BACKUP_FOLDER}:/children`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'images',
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      }),
    });
  }
}

async function graphFetch(accessToken: string, endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${GRAPH_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Graph API ${response.status}: ${errorText}`);
  }
  return response;
}

async function ensureBackupFolder(accessToken: string) {
  try {
    await graphFetch(accessToken, `/me/drive/root:/${BACKUP_FOLDER}`);
  } catch {
    await graphFetch(accessToken, '/me/drive/root/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: BACKUP_FOLDER,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      }),
    });
  }
}

async function uploadFile(accessToken: string, filename: string, data: Blob) {
  const uploadPath = `/me/drive/root:/${BACKUP_FOLDER}/${filename}:/content`;

  if (data.size < 4 * 1024 * 1024) {
    await graphFetch(accessToken, uploadPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: data,
    });
    return;
  }

  const sessionResponse = await graphFetch(
    accessToken,
    `/me/drive/root:/${BACKUP_FOLDER}/${filename}:/createUploadSession`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    },
  );
  const { uploadUrl } = await sessionResponse.json();
  await uploadLargeBlob(uploadUrl, data);
}

async function uploadLargeBlob(uploadUrl: string, data: Blob) {
  const CHUNK_SIZE = 5 * 1024 * 1024;
  const totalSize = data.size;
  let offset = 0;

  while (offset < totalSize) {
    const end = Math.min(offset + CHUNK_SIZE, totalSize);
    const chunk = data.slice(offset, end);
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': `${chunk.size}`,
        'Content-Range': `bytes ${offset}-${end - 1}/${totalSize}`,
      },
      body: chunk,
    });
    offset = end;
  }
}

async function rotateBackups(accessToken: string) {
  const response = await graphFetch(
    accessToken,
    `/me/drive/root:/${BACKUP_FOLDER}:/children?$orderby=lastModifiedDateTime desc`,
  );
  const data = await response.json();
  interface DriveItem { id: string; name: string }
  const backups = (data.value as DriveItem[]).filter(
    (item) => item.name.startsWith('backup-') && item.name !== 'backup-meta.json',
  );
  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS);
    await Promise.all(
      toDelete.map((item) =>
        fetch(`${GRAPH_BASE}/me/drive/items/${item.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ),
    );
  }
}

setInterval(async () => {
  for (const [principal, session] of backupSessions.entries()) {
    if (!session.accessToken || session.backupInProgress || !session.lastUserId) {
      continue;
    }

    try {
      session.backupInProgress = true;
      await performBackup(session, session.accessToken, session.lastUserId);
      console.log(`Periodic backup completed for ${principal} at`, session.lastBackupTime);
    } catch (err) {
      console.error(`Periodic backup failed for ${principal}:`, err);
      session.lastBackupError = err instanceof Error ? err.message : String(err);
    } finally {
      session.backupInProgress = false;
    }
  }
}, 5 * 60 * 1000);

void DATA_DIR;
