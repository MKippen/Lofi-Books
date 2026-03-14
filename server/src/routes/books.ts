import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { execute, placeholders, queryRow, queryRows, queryValue, withTransaction } from '../db.js';
import { asyncHandler } from '../http.js';
import { toCamel, toCamelArray, camelToSnake } from '../util.js';

export const booksRouter = Router();

const BOOK_ALLOWED_FIELDS = new Set([
  'title', 'description', 'coverImageId', 'genre',
]);

booksRouter.get('/', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  const books = await queryRows('SELECT * FROM books WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  res.json(toCamelArray(books as Record<string, unknown>[]));
}));

booksRouter.get('/:id', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  const book = await queryRow('SELECT * FROM books WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(toCamel(book as Record<string, unknown>));
}));

booksRouter.post('/', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  const id = uuid();
  const now = new Date().toISOString();
  const { title, description = '', coverImageId = null, genre = '' } = req.body;

  await execute(
    `INSERT INTO books (id, title, description, cover_image_id, genre, user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, title, description, coverImageId, genre, userId, now, now],
  );

  res.status(201).json({ id });
}));

booksRouter.put('/:id', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  const now = new Date().toISOString();
  const book = await queryRow('SELECT * FROM books WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (!BOOK_ALLOWED_FIELDS.has(key)) continue;
    values.push(value);
    fields.push(`${camelToSnake(key)} = $${values.length}`);
  }
  fields.push(`updated_at = $${values.length + 1}`);
  values.push(now, req.params.id);

  await execute(`UPDATE books SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
  res.json({ ok: true });
}));

booksRouter.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  await execute('DELETE FROM books WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
  res.json({ ok: true });
}));

booksRouter.post('/claim-orphaned', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  if (!userId) return res.status(400).json({ error: 'No user ID' });

  const orphanedCount = Number(await queryValue('SELECT COUNT(*)::int AS count FROM books WHERE user_id = $1', ['']) || 0);
  if (orphanedCount === 0) return res.json({ claimed: 0 });

  await withTransaction(async (client) => {
    await execute('UPDATE books SET user_id = $1 WHERE user_id = $2', [userId, ''], client);
    await execute('UPDATE wishlist_items SET user_id = $1 WHERE user_id = $2', [userId, ''], client);
  });

  res.json({ claimed: orphanedCount });
}));

async function verifyBookOwner(req: any, res: any): Promise<boolean> {
  const userId = req.userId as string;
  const bookId = req.params.bookId;
  const book = await queryRow('SELECT id FROM books WHERE id = $1 AND user_id = $2', [bookId, userId]);
  if (!book) {
    res.status(404).json({ error: 'Book not found' });
    return false;
  }
  return true;
}

booksRouter.get('/:bookId/characters', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const chars = await queryRows(
    'SELECT * FROM characters WHERE book_id = $1 ORDER BY sort_order',
    [req.params.bookId],
  );
  res.json((chars as Record<string, unknown>[]).map(parseCharacterRow));
}));

booksRouter.post('/:bookId/characters', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;
  const sortOrder = Number(await queryValue(
    'SELECT COALESCE(MAX(sort_order), -1)::bigint + 1 AS next_sort_order FROM characters WHERE book_id = $1',
    [bookId],
  ) || 0);

  const {
    name, mainImageId = null, backstory = '', development = '',
    personalityTraits = [], relationships = [], specialAbilities = [],
    role = 'supporting',
  } = req.body;

  await execute(
    `INSERT INTO characters (
      id, book_id, name, main_image_id, backstory, development,
      personality_traits, relationships, special_abilities, role, sort_order, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      bookId,
      name,
      mainImageId,
      backstory,
      development,
      JSON.stringify(personalityTraits),
      JSON.stringify(relationships),
      JSON.stringify(specialAbilities),
      role,
      sortOrder,
      now,
      now,
    ],
  );

  res.status(201).json({ id });
}));

booksRouter.put('/:bookId/characters/reorder', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const { orderedIds } = req.body as { orderedIds: string[] };
  await withTransaction(async (client) => {
    for (const [index, id] of orderedIds.entries()) {
      await execute('UPDATE characters SET sort_order = $1 WHERE id = $2', [index, id], client);
    }
  });
  res.json({ ok: true });
}));

booksRouter.get('/:bookId/chapters', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const chapters = await queryRows(
    'SELECT * FROM chapters WHERE book_id = $1 ORDER BY sort_order',
    [req.params.bookId],
  );
  res.json(toCamelArray(chapters as Record<string, unknown>[]));
}));

booksRouter.post('/:bookId/chapters', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;
  const sortOrder = Number(await queryValue(
    'SELECT COALESCE(MAX(sort_order), -1)::bigint + 1 AS next_sort_order FROM chapters WHERE book_id = $1',
    [bookId],
  ) || 0);

  const {
    title, content = '', wordCount = 0, status = 'draft', notes = '',
  } = req.body;

  await execute(
    `INSERT INTO chapters (
      id, book_id, title, content, sort_order, word_count, status, notes, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [id, bookId, title, content, sortOrder, wordCount, status, notes, now, now],
  );

  res.status(201).json({ id });
}));

booksRouter.put('/:bookId/chapters/reorder', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const { orderedIds } = req.body as { orderedIds: string[] };
  await withTransaction(async (client) => {
    for (const [index, id] of orderedIds.entries()) {
      await execute('UPDATE chapters SET sort_order = $1 WHERE id = $2', [index, id], client);
    }
  });
  res.json({ ok: true });
}));

booksRouter.get('/:bookId/ideas', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const ideas = await queryRows(
    'SELECT * FROM ideas WHERE book_id = $1 ORDER BY z_index',
    [req.params.bookId],
  );
  res.json(toCamelArray(ideas as Record<string, unknown>[]));
}));

booksRouter.post('/:bookId/ideas', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;
  const zIndex = Number(await queryValue(
    'SELECT COALESCE(MAX(z_index), 0)::bigint + 1 AS next_z FROM ideas WHERE book_id = $1',
    [bookId],
  ) || 1);

  const {
    type = 'note', title = '', description = '', imageId = null,
    color = 'sakura-white', positionX = 100, positionY = 100,
    width = 220, height = 180, linkedChapterId = null,
  } = req.body;

  await execute(
    `INSERT INTO ideas (
      id, book_id, type, title, description, image_id, color,
      position_x, position_y, width, height, z_index, linked_chapter_id, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      id,
      bookId,
      type,
      title,
      description,
      imageId,
      color,
      positionX,
      positionY,
      width,
      height,
      zIndex,
      linkedChapterId,
      now,
      now,
    ],
  );

  res.status(201).json({ id });
}));

booksRouter.get('/:bookId/chapters/:chapterId/illustrations', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const illustrations = await queryRows(
    'SELECT * FROM chapter_illustrations WHERE chapter_id = $1 AND book_id = $2 ORDER BY sort_order',
    [req.params.chapterId, req.params.bookId],
  );
  res.json(toCamelArray(illustrations as Record<string, unknown>[]));
}));

booksRouter.post('/:bookId/chapters/:chapterId/illustrations', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;
  const chapterId = req.params.chapterId;
  const { imageId, caption = '' } = req.body;
  const sortOrder = Number(await queryValue(
    'SELECT COALESCE(MAX(sort_order), -1)::bigint + 1 AS next_sort_order FROM chapter_illustrations WHERE chapter_id = $1',
    [chapterId],
  ) || 0);

  await execute(
    `INSERT INTO chapter_illustrations (
      id, chapter_id, book_id, image_id, caption, sort_order, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, chapterId, bookId, imageId, caption, sortOrder, now, now],
  );

  res.status(201).json({ id });
}));

booksRouter.get('/:bookId/connections', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const connections = await queryRows(
    'SELECT * FROM connections WHERE book_id = $1 ORDER BY created_at',
    [req.params.bookId],
  );
  res.json(toCamelArray(connections as Record<string, unknown>[]));
}));

booksRouter.post('/:bookId/connections', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;
  const { fromIdeaId, toIdeaId, color = 'red' } = req.body;

  await execute(
    `INSERT INTO connections (id, book_id, from_idea_id, to_idea_id, color, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, bookId, fromIdeaId, toIdeaId, color, now, now],
  );

  res.status(201).json({ id });
}));

booksRouter.get('/:bookId/timeline', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const events = await queryRows(
    'SELECT * FROM timeline_events WHERE book_id = $1 ORDER BY sort_order',
    [req.params.bookId],
  );
  res.json((events as Record<string, unknown>[]).map((row) => {
    const camel = toCamel(row);
    const c = camel as Record<string, unknown>;
    return {
      ...c,
      characterIds: JSON.parse((c.characterIds as string) || '[]'),
    };
  }));
}));

booksRouter.post('/:bookId/timeline', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;

  const {
    chapterId = null, characterIds = [], title = '', description = '',
    eventType = 'plot', sortOrder = 0, color = '',
  } = req.body;

  await execute(
    `INSERT INTO timeline_events (
      id, book_id, chapter_id, character_ids, title, description, event_type, sort_order, color, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [id, bookId, chapterId, JSON.stringify(characterIds), title, description, eventType, sortOrder, color, now, now],
  );

  res.status(201).json({ id });
}));

booksRouter.put('/:bookId/timeline/reorder', asyncHandler(async (req, res) => {
  if (!await verifyBookOwner(req, res)) return;
  const { orderedIds } = req.body as { orderedIds: string[] };
  await withTransaction(async (client) => {
    for (const [index, id] of orderedIds.entries()) {
      await execute('UPDATE timeline_events SET sort_order = $1 WHERE id = $2', [index, id], client);
    }
  });
  res.json({ ok: true });
}));

function parseCharacterRow(row: Record<string, unknown>) {
  const camel = toCamel(row);
  const c = camel as Record<string, unknown>;
  return {
    ...c,
    personalityTraits: JSON.parse((c.personalityTraits as string) || '[]'),
    relationships: JSON.parse((c.relationships as string) || '[]'),
    specialAbilities: JSON.parse((c.specialAbilities as string) || '[]'),
  };
}
