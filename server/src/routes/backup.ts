import { Router } from 'express';
import { db, DATA_DIR } from '../db.js';
import fs from 'fs';
import path from 'path';

export const backupRouter = Router();

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Convert camelCase keys to snake_case (handles old Dexie backup format)
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
}

function toSnakeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    // SQLite TEXT columns can't store arrays/objects — stringify them
    if (Array.isArray(value) || (value !== null && typeof value === 'object' && !(value instanceof Date))) {
      result[snakeKey] = JSON.stringify(value);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}
const BACKUP_FOLDER = 'Lofi Books';
const MAX_BACKUPS = 3;
const MUTATION_DEBOUNCE_MS = 30_000; // 30 seconds after last mutation

// In-memory state for backup status
let lastBackupTime: string | null = null;
let lastBackupError: string | null = null;
let backupInProgress = false;
let lastAccessToken: string | null = null;
let lastUserId: string | null = null;
let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Get backup status
backupRouter.get('/status', (_req, res) => {
  res.json({
    lastBackupTime,
    lastBackupError,
    backupInProgress,
    isConnected: lastAccessToken !== null,
  });
});

// Check if the current user has any data (used for first-load restore prompt)
backupRouter.get('/has-data', (req, res) => {
  const userId = (req as any).userId as string;
  const row = db.prepare('SELECT COUNT(*) as count FROM books WHERE user_id = ?').get(userId) as { count: number };
  res.json({ hasData: row.count > 0, bookCount: row.count });
});

// Get remote backup metadata from OneDrive
backupRouter.get('/remote-meta', async (_req, res) => {
  if (!lastAccessToken) {
    return res.json(null);
  }
  try {
    const response = await graphFetch(
      lastAccessToken,
      `/me/drive/root:/${BACKUP_FOLDER}/backup-meta.json:/content`,
    );
    const metadata = await response.json();
    res.json(metadata);
  } catch {
    res.json(null);
  }
});

// Register access token (client sends this after login)
backupRouter.post('/token', (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'Missing accessToken' });
  lastAccessToken = accessToken;
  lastUserId = (req as any).userId as string || '';
  res.json({ ok: true });
});

// Trigger manual backup
backupRouter.post('/trigger', async (req, res) => {
  const token = req.body.accessToken || lastAccessToken;
  if (!token) return res.status(400).json({ error: 'No access token available' });

  if (backupInProgress) return res.json({ ok: true, message: 'Backup already in progress' });

  try {
    const userId = (req as any).userId as string || '';
    backupInProgress = true;
    lastAccessToken = token;
    lastUserId = userId;
    await performBackup(token, userId);
    res.json({ ok: true, lastBackupTime });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    lastBackupError = msg;
    res.status(500).json({ error: msg });
  } finally {
    backupInProgress = false;
  }
});

// Notify server of a data mutation (triggers debounced backup)
backupRouter.post('/notify-mutation', (req, res) => {
  if (!lastAccessToken) {
    return res.json({ ok: true, message: 'No token, skipping' });
  }

  const userId = (req as any).userId as string || lastUserId || '';

  if (mutationDebounceTimer) {
    clearTimeout(mutationDebounceTimer);
  }

  mutationDebounceTimer = setTimeout(async () => {
    if (lastAccessToken && !backupInProgress) {
      try {
        backupInProgress = true;
        await performBackup(lastAccessToken, userId);
        console.log('Mutation-triggered backup completed at', lastBackupTime);
      } catch (err) {
        console.error('Mutation-triggered backup failed:', err);
        lastBackupError = err instanceof Error ? err.message : String(err);
      } finally {
        backupInProgress = false;
      }
    }
  }, MUTATION_DEBOUNCE_MS);

  res.json({ ok: true });
});

// List available backup files on OneDrive
backupRouter.get('/list', async (_req, res) => {
  if (!lastAccessToken) return res.json([]);
  try {
    const response = await graphFetch(
      lastAccessToken,
      `/me/drive/root:/${BACKUP_FOLDER}:/children?$orderby=lastModifiedDateTime desc`,
    );
    const data = await response.json();
    interface DriveItem { name: string; size: number; lastModifiedDateTime: string }
    const backups = (data.value as DriveItem[])
      .filter((item: DriveItem) => item.name.startsWith('backup-') && item.name.endsWith('.json') && item.name !== 'backup-meta.json')
      .map((item: DriveItem) => ({
        name: item.name,
        size: item.size,
        lastModified: item.lastModifiedDateTime,
      }));
    // Also include latest-backup.json
    const latest = (data.value as DriveItem[]).find((item: DriveItem) => item.name === 'latest-backup.json');
    if (latest) {
      backups.unshift({ name: latest.name, size: latest.size, lastModified: latest.lastModifiedDateTime });
    }
    res.json(backups);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// Import data from client-side (e.g., old Dexie/IndexedDB migration)
backupRouter.post('/import-local', (req, res) => {
  const userId = (req as any).userId as string;
  if (!userId) return res.status(400).json({ error: 'No user ID' });

  const data = req.body;

  // Validate structure
  const requiredKeys = ['books', 'characters', 'chapters', 'ideas',
    'timelineEvents', 'wishlistItems', 'images'];
  for (const key of requiredKeys) {
    if (!Array.isArray(data[key])) {
      return res.status(400).json({ error: `Invalid data: missing ${key}` });
    }
  }
  if (!Array.isArray(data.connections)) data.connections = [];
  if (!Array.isArray(data.chapterIllustrations)) data.chapterIllustrations = [];

  console.log('Import-local: importing data for user', userId, '—', {
    books: data.books.length,
    characters: data.characters.length,
    chapters: data.chapters.length,
    ideas: data.ideas.length,
    timelineEvents: data.timelineEvents.length,
    wishlistItems: data.wishlistItems.length,
    images: data.images.length,
  });

  try {
    importAllData(data, userId);
    const result = {
      ok: true,
      bookCount: data.books.length,
      totalRecords: data.books.length + data.characters.length +
        data.chapters.length + data.ideas.length +
        data.timelineEvents.length + data.wishlistItems.length,
    };
    console.log('Import-local: success', result);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Import-local: failed —', msg);
    res.status(500).json({ error: msg });
  }
});

// Restore from OneDrive backup
backupRouter.post('/restore', async (req, res) => {
  const userId = (req as any).userId as string;
  const token = req.body.accessToken || lastAccessToken;
  if (!token) return res.status(400).json({ error: 'No access token available' });
  const filename = req.body.filename || 'latest-backup.json';

  try {
    const response = await graphFetch(
      token,
      `/me/drive/root:/${BACKUP_FOLDER}/${filename}:/content`,
    );
    const data = await response.json();

    // Validate structure (connections + chapterIllustrations are optional for old backups)
    const requiredKeys = ['books', 'characters', 'chapters', 'ideas',
      'timelineEvents', 'wishlistItems', 'images'];
    for (const key of requiredKeys) {
      if (!Array.isArray(data[key])) {
        return res.status(400).json({ error: `Invalid backup: missing ${key}` });
      }
    }
    // Default optional arrays
    if (!Array.isArray(data.connections)) data.connections = [];
    if (!Array.isArray(data.chapterIllustrations)) data.chapterIllustrations = [];

    console.log('Restore: importing data for user', userId, '—', {
      books: data.books.length,
      characters: data.characters.length,
      chapters: data.chapters.length,
      ideas: data.ideas.length,
      timelineEvents: data.timelineEvents.length,
      wishlistItems: data.wishlistItems.length,
      images: data.images.length,
    });

    importAllData(data, userId);

    lastAccessToken = token;
    lastBackupTime = new Date().toISOString();
    lastBackupError = null;

    const result = {
      ok: true,
      bookCount: data.books.length,
      totalRecords: data.books.length + data.characters.length +
        data.chapters.length + data.ideas.length +
        data.timelineEvents.length + data.wishlistItems.length,
    };
    console.log('Restore: success', result);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Restore: failed —', msg);
    res.status(500).json({ error: msg });
  }
});

// --- Backup logic ---

async function performBackup(accessToken: string, userId: string = '') {
  const data = userId ? exportUserData(userId) : exportAllData();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });

  await ensureBackupFolder(accessToken);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const timestampedName = `backup-${timestamp}.json`;

  await Promise.all([
    uploadFile(accessToken, 'latest-backup.json', blob),
    uploadFile(accessToken, timestampedName, blob),
  ]);

  const metadata = {
    timestamp: new Date().toISOString(),
    version: 2,
    bookCount: data.books.length,
    totalRecords: data.books.length + data.characters.length + data.chapters.length +
      data.ideas.length + data.timelineEvents.length + data.wishlistItems.length,
  };
  const metaBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
  await uploadFile(accessToken, 'backup-meta.json', metaBlob);

  lastBackupTime = new Date().toISOString();
  lastBackupError = null;

  try {
    await rotateBackups(accessToken);
  } catch (err) {
    console.warn('Backup rotation failed:', err);
  }
}

function exportAllData() {
  // Export all data (for OneDrive backup — scoped per-user via OneDrive account)
  return {
    books: db.prepare('SELECT * FROM books').all(),
    characters: db.prepare('SELECT * FROM characters').all(),
    chapters: db.prepare('SELECT * FROM chapters').all(),
    ideas: db.prepare('SELECT * FROM ideas').all(),
    connections: db.prepare('SELECT * FROM connections').all(),
    chapterIllustrations: db.prepare('SELECT * FROM chapter_illustrations').all(),
    timelineEvents: db.prepare('SELECT * FROM timeline_events').all(),
    wishlistItems: db.prepare('SELECT * FROM wishlist_items').all(),
    images: db.prepare('SELECT * FROM images').all(),
  };
}

function exportUserData(userId: string) {
  const bookIds = db.prepare('SELECT id FROM books WHERE user_id = ?').all(userId) as { id: string }[];
  const bookIdList = bookIds.map(b => b.id);

  if (bookIdList.length === 0) {
    return {
      books: [],
      characters: [],
      chapters: [],
      ideas: [],
      connections: [],
      chapterIllustrations: [],
      timelineEvents: [],
      wishlistItems: db.prepare('SELECT * FROM wishlist_items WHERE user_id = ?').all(userId),
      images: [],
    };
  }

  const placeholders = bookIdList.map(() => '?').join(',');
  return {
    books: db.prepare(`SELECT * FROM books WHERE user_id = ?`).all(userId),
    characters: db.prepare(`SELECT * FROM characters WHERE book_id IN (${placeholders})`).all(...bookIdList),
    chapters: db.prepare(`SELECT * FROM chapters WHERE book_id IN (${placeholders})`).all(...bookIdList),
    ideas: db.prepare(`SELECT * FROM ideas WHERE book_id IN (${placeholders})`).all(...bookIdList),
    connections: db.prepare(`SELECT * FROM connections WHERE book_id IN (${placeholders})`).all(...bookIdList),
    chapterIllustrations: db.prepare(`SELECT * FROM chapter_illustrations WHERE book_id IN (${placeholders})`).all(...bookIdList),
    timelineEvents: db.prepare(`SELECT * FROM timeline_events WHERE book_id IN (${placeholders})`).all(...bookIdList),
    wishlistItems: db.prepare(`SELECT * FROM wishlist_items WHERE user_id = ?`).all(userId),
    images: db.prepare(`SELECT * FROM images WHERE book_id IN (${placeholders})`).all(...bookIdList),
  };
}

function importAllData(data: ReturnType<typeof exportAllData>, userId: string) {
  const restore = db.transaction(() => {
    db.pragma('foreign_keys = OFF');

    // Find all book IDs belonging to this user (to scope cascade deletes)
    const existingBookIds = (db.prepare('SELECT id FROM books WHERE user_id = ?').all(userId) as { id: string }[]).map(b => b.id);

    if (existingBookIds.length > 0) {
      const ph = existingBookIds.map(() => '?').join(',');
      // Clear child tables for this user's books
      db.prepare(`DELETE FROM images WHERE book_id IN (${ph})`).run(...existingBookIds);
      db.prepare(`DELETE FROM chapter_illustrations WHERE book_id IN (${ph})`).run(...existingBookIds);
      db.prepare(`DELETE FROM connections WHERE book_id IN (${ph})`).run(...existingBookIds);
      db.prepare(`DELETE FROM timeline_events WHERE book_id IN (${ph})`).run(...existingBookIds);
      db.prepare(`DELETE FROM ideas WHERE book_id IN (${ph})`).run(...existingBookIds);
      db.prepare(`DELETE FROM chapters WHERE book_id IN (${ph})`).run(...existingBookIds);
      db.prepare(`DELETE FROM characters WHERE book_id IN (${ph})`).run(...existingBookIds);
    }
    // Clear this user's books and wishlist
    db.prepare('DELETE FROM books WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM wishlist_items WHERE user_id = ?').run(userId);

    // Normalize rows: convert camelCase keys to snake_case (handles old Dexie backups)
    const normalize = (rows: unknown[]) =>
      rows.map((row) => toSnakeKeys(row as Record<string, unknown>));

    // Insert books (stamp with current user_id)
    const insertBook = db.prepare(`
      INSERT INTO books (id, title, description, cover_image_id, genre, user_id, created_at, updated_at)
      VALUES (@id, @title, @description, @cover_image_id, @genre, @user_id, @created_at, @updated_at)
    `);
    for (const row of normalize(data.books)) {
      const r = row as Record<string, unknown>;
      r.user_id = userId; // Always stamp with current user
      insertBook.run(r);
    }

    // Insert characters
    const insertChar = db.prepare(`
      INSERT INTO characters (id, book_id, name, main_image_id, backstory, development,
        personality_traits, relationships, special_abilities, role, sort_order, created_at, updated_at)
      VALUES (@id, @book_id, @name, @main_image_id, @backstory, @development,
        @personality_traits, @relationships, @special_abilities, @role, @sort_order, @created_at, @updated_at)
    `);
    for (const row of normalize(data.characters)) insertChar.run(row);

    // Insert chapters
    const insertChapter = db.prepare(`
      INSERT INTO chapters (id, book_id, title, content, sort_order, word_count, status, notes, created_at, updated_at)
      VALUES (@id, @book_id, @title, @content, @sort_order, @word_count, @status, @notes, @created_at, @updated_at)
    `);
    for (const row of normalize(data.chapters)) insertChapter.run(row);

    // Insert ideas
    const insertIdea = db.prepare(`
      INSERT INTO ideas (id, book_id, type, title, description, image_id, color,
        position_x, position_y, width, height, z_index, linked_chapter_id, created_at, updated_at)
      VALUES (@id, @book_id, @type, @title, @description, @image_id, @color,
        @position_x, @position_y, @width, @height, @z_index, @linked_chapter_id, @created_at, @updated_at)
    `);
    for (const row of normalize(data.ideas)) insertIdea.run(row);

    // Insert connections (if present — may not exist in older backups)
    if (Array.isArray(data.connections)) {
      const insertConnection = db.prepare(`
        INSERT INTO connections (id, book_id, from_idea_id, to_idea_id, color, created_at, updated_at)
        VALUES (@id, @book_id, @from_idea_id, @to_idea_id, @color, @created_at, @updated_at)
      `);
      for (const row of normalize(data.connections)) insertConnection.run(row);
    }

    // Insert chapter illustrations (if present)
    if (Array.isArray(data.chapterIllustrations)) {
      const insertIllustration = db.prepare(`
        INSERT INTO chapter_illustrations (id, chapter_id, book_id, image_id, caption, sort_order, created_at, updated_at)
        VALUES (@id, @chapter_id, @book_id, @image_id, @caption, @sort_order, @created_at, @updated_at)
      `);
      for (const row of normalize(data.chapterIllustrations)) insertIllustration.run(row);
    }

    // Insert timeline events
    const insertEvent = db.prepare(`
      INSERT INTO timeline_events (id, book_id, chapter_id, character_ids, title, description, event_type, sort_order, color, created_at, updated_at)
      VALUES (@id, @book_id, @chapter_id, @character_ids, @title, @description, @event_type, @sort_order, @color, @created_at, @updated_at)
    `);
    for (const row of normalize(data.timelineEvents)) {
      const r = row as Record<string, unknown>;
      if (!r.character_ids) r.character_ids = '[]';
      insertEvent.run(r);
    }

    // Insert wishlist items (stamp with current user_id)
    const insertWishlist = db.prepare(`
      INSERT INTO wishlist_items (id, title, description, type, status, user_id, created_at, updated_at)
      VALUES (@id, @title, @description, @type, @status, @user_id, @created_at, @updated_at)
    `);
    for (const row of normalize(data.wishlistItems)) {
      const r = row as Record<string, unknown>;
      r.user_id = userId;
      insertWishlist.run(r);
    }

    // Insert images (metadata only)
    const insertImage = db.prepare(`
      INSERT INTO images (id, book_id, filename, mime_type, size, created_at)
      VALUES (@id, @book_id, @filename, @mime_type, @size, @created_at)
    `);
    for (const row of normalize(data.images)) insertImage.run(row);

    db.pragma('foreign_keys = ON');
  });

  restore();
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
  } else {
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
}

async function rotateBackups(accessToken: string) {
  const response = await graphFetch(
    accessToken,
    `/me/drive/root:/${BACKUP_FOLDER}:/children?$orderby=lastModifiedDateTime desc`,
  );
  const data = await response.json();
  interface DriveItem { id: string; name: string }
  const backups = (data.value as DriveItem[]).filter(
    (item: DriveItem) => item.name.startsWith('backup-') && item.name !== 'backup-meta.json',
  );
  if (backups.length > MAX_BACKUPS) {
    const toDelete = backups.slice(MAX_BACKUPS);
    await Promise.all(
      toDelete.map((item: DriveItem) =>
        fetch(`${GRAPH_BASE}/me/drive/items/${item.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ),
    );
  }
}

// Periodic backup every 5 minutes (safety net, if token is available)
setInterval(async () => {
  if (lastAccessToken && !backupInProgress && lastUserId) {
    try {
      backupInProgress = true;
      await performBackup(lastAccessToken, lastUserId);
      console.log('Periodic backup completed at', lastBackupTime);
    } catch (err) {
      console.error('Periodic backup failed:', err);
      lastBackupError = err instanceof Error ? err.message : String(err);
    } finally {
      backupInProgress = false;
    }
  }
}, 5 * 60 * 1000);
