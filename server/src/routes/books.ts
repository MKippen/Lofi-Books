import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db.js';
import { toCamel, toCamelArray, camelToSnake } from '../util.js';

export const booksRouter = Router();

// List all books
booksRouter.get('/', (_req, res) => {
  const books = db.prepare('SELECT * FROM books ORDER BY created_at DESC').all();
  res.json(toCamelArray(books as Record<string, unknown>[]));
});

// Get single book
booksRouter.get('/:id', (req, res) => {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(toCamel(book as Record<string, unknown>));
});

// Create book
booksRouter.post('/', (req, res) => {
  const id = uuid();
  const now = new Date().toISOString();
  const { title, description = '', coverImageId = null, genre = '' } = req.body;

  db.prepare(`
    INSERT INTO books (id, title, description, cover_image_id, genre, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description, coverImageId, genre, now, now);

  res.status(201).json({ id });
});

// Update book
booksRouter.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    const col = camelToSnake(key);
    fields.push(`${col} = ?`);
    values.push(value);
  }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(req.params.id);

  db.prepare(`UPDATE books SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Delete book (cascade handled by foreign keys)
booksRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Nested routes for book children ---

// Characters for a book
booksRouter.get('/:bookId/characters', (req, res) => {
  const chars = db.prepare(
    'SELECT * FROM characters WHERE book_id = ? ORDER BY sort_order'
  ).all(req.params.bookId) as Record<string, unknown>[];
  res.json(chars.map(parseCharacterRow));
});

booksRouter.post('/:bookId/characters', (req, res) => {
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;

  const maxRow = db.prepare(
    'SELECT MAX(sort_order) as max_order FROM characters WHERE book_id = ?'
  ).get(bookId) as { max_order: number | null };
  const sortOrder = (maxRow?.max_order ?? -1) + 1;

  const {
    name, mainImageId = null, backstory = '', development = '',
    personalityTraits = [], relationships = [], specialAbilities = [],
    role = 'supporting',
  } = req.body;

  db.prepare(`
    INSERT INTO characters (id, book_id, name, main_image_id, backstory, development,
      personality_traits, relationships, special_abilities, role, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, bookId, name, mainImageId, backstory, development,
    JSON.stringify(personalityTraits), JSON.stringify(relationships),
    JSON.stringify(specialAbilities), role, sortOrder, now, now);

  res.status(201).json({ id });
});

booksRouter.put('/:bookId/characters/reorder', (req, res) => {
  const { orderedIds } = req.body as { orderedIds: string[] };
  const stmt = db.prepare('UPDATE characters SET sort_order = ? WHERE id = ?');
  const reorder = db.transaction(() => {
    orderedIds.forEach((id, index) => stmt.run(index, id));
  });
  reorder();
  res.json({ ok: true });
});

// Chapters for a book
booksRouter.get('/:bookId/chapters', (req, res) => {
  const chapters = db.prepare(
    'SELECT * FROM chapters WHERE book_id = ? ORDER BY sort_order'
  ).all(req.params.bookId);
  res.json(toCamelArray(chapters as Record<string, unknown>[]));
});

booksRouter.post('/:bookId/chapters', (req, res) => {
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;

  const maxRow = db.prepare(
    'SELECT MAX(sort_order) as max_order FROM chapters WHERE book_id = ?'
  ).get(bookId) as { max_order: number | null };
  const sortOrder = (maxRow?.max_order ?? -1) + 1;

  const {
    title, content = '', wordCount = 0, status = 'draft', notes = '',
  } = req.body;

  db.prepare(`
    INSERT INTO chapters (id, book_id, title, content, sort_order, word_count, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, bookId, title, content, sortOrder, wordCount, status, notes, now, now);

  res.status(201).json({ id });
});

booksRouter.put('/:bookId/chapters/reorder', (req, res) => {
  const { orderedIds } = req.body as { orderedIds: string[] };
  const stmt = db.prepare('UPDATE chapters SET sort_order = ? WHERE id = ?');
  const reorder = db.transaction(() => {
    orderedIds.forEach((id, index) => stmt.run(index, id));
  });
  reorder();
  res.json({ ok: true });
});

// Ideas for a book
booksRouter.get('/:bookId/ideas', (req, res) => {
  const ideas = db.prepare(
    'SELECT * FROM ideas WHERE book_id = ? ORDER BY z_index'
  ).all(req.params.bookId);
  res.json(toCamelArray(ideas as Record<string, unknown>[]));
});

booksRouter.post('/:bookId/ideas', (req, res) => {
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;

  const maxRow = db.prepare(
    'SELECT MAX(z_index) as max_z FROM ideas WHERE book_id = ?'
  ).get(bookId) as { max_z: number | null };
  const zIndex = (maxRow?.max_z ?? 0) + 1;

  const {
    type = 'note', title = '', description = '', imageId = null,
    color = 'sakura-white', positionX = 100, positionY = 100,
    width = 220, height = 180, linkedChapterId = null,
  } = req.body;

  db.prepare(`
    INSERT INTO ideas (id, book_id, type, title, description, image_id, color,
      position_x, position_y, width, height, z_index, linked_chapter_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, bookId, type, title, description, imageId, color,
    positionX, positionY, width, height, zIndex, linkedChapterId, now, now);

  res.status(201).json({ id });
});

// Illustrations for a chapter
booksRouter.get('/:bookId/chapters/:chapterId/illustrations', (req, res) => {
  const illustrations = db.prepare(
    'SELECT * FROM chapter_illustrations WHERE chapter_id = ? AND book_id = ? ORDER BY sort_order'
  ).all(req.params.chapterId, req.params.bookId);
  res.json(toCamelArray(illustrations as Record<string, unknown>[]));
});

booksRouter.post('/:bookId/chapters/:chapterId/illustrations', (req, res) => {
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;
  const chapterId = req.params.chapterId;

  const { imageId, caption = '' } = req.body;

  const maxRow = db.prepare(
    'SELECT MAX(sort_order) as max_order FROM chapter_illustrations WHERE chapter_id = ?'
  ).get(chapterId) as { max_order: number | null };
  const sortOrder = (maxRow?.max_order ?? -1) + 1;

  db.prepare(`
    INSERT INTO chapter_illustrations (id, chapter_id, book_id, image_id, caption, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, chapterId, bookId, imageId, caption, sortOrder, now, now);

  res.status(201).json({ id });
});

// Connections for a book
booksRouter.get('/:bookId/connections', (req, res) => {
  const connections = db.prepare(
    'SELECT * FROM connections WHERE book_id = ? ORDER BY created_at'
  ).all(req.params.bookId);
  res.json(toCamelArray(connections as Record<string, unknown>[]));
});

booksRouter.post('/:bookId/connections', (req, res) => {
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;

  const { fromIdeaId, toIdeaId, color = 'red' } = req.body;

  db.prepare(`
    INSERT INTO connections (id, book_id, from_idea_id, to_idea_id, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, bookId, fromIdeaId, toIdeaId, color, now, now);

  res.status(201).json({ id });
});

// Timeline for a book
booksRouter.get('/:bookId/timeline', (req, res) => {
  const events = db.prepare(
    'SELECT * FROM timeline_events WHERE book_id = ? ORDER BY sort_order'
  ).all(req.params.bookId) as Record<string, unknown>[];
  res.json(events.map((row) => {
    const camel = toCamel(row);
    const c = camel as Record<string, unknown>;
    return {
      ...c,
      characterIds: JSON.parse(c.characterIds as string || '[]'),
    };
  }));
});

booksRouter.post('/:bookId/timeline', (req, res) => {
  const id = uuid();
  const now = new Date().toISOString();
  const bookId = req.params.bookId;

  const {
    chapterId = null, characterIds = [], title = '', description = '',
    eventType = 'plot', sortOrder = 0, color = '',
  } = req.body;

  db.prepare(`
    INSERT INTO timeline_events (id, book_id, chapter_id, character_ids, title, description, event_type, sort_order, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, bookId, chapterId, JSON.stringify(characterIds), title, description, eventType, sortOrder, color, now, now);

  res.status(201).json({ id });
});

booksRouter.put('/:bookId/timeline/reorder', (req, res) => {
  const { orderedIds } = req.body as { orderedIds: string[] };
  const stmt = db.prepare('UPDATE timeline_events SET sort_order = ? WHERE id = ?');
  const reorder = db.transaction(() => {
    orderedIds.forEach((id, index) => stmt.run(index, id));
  });
  reorder();
  res.json({ ok: true });
});

function parseCharacterRow(row: Record<string, unknown>) {
  const camel = toCamel(row);
  const c = camel as Record<string, unknown>;
  return {
    ...c,
    personalityTraits: JSON.parse(c.personalityTraits as string || '[]'),
    relationships: JSON.parse(c.relationships as string || '[]'),
    specialAbilities: JSON.parse(c.specialAbilities as string || '[]'),
  };
}
