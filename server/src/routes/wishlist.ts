import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db.js';
import { toCamelArray, camelToSnake } from '../util.js';

export const wishlistRouter = Router();

const ALLOWED_FIELDS = new Set(['title', 'description', 'type', 'status']);

// List ALL wishlist items (shared across all users)
wishlistRouter.get('/', (_req, res) => {
  const items = db.prepare('SELECT * FROM wishlist_items ORDER BY created_at DESC').all();
  res.json(toCamelArray(items as Record<string, unknown>[]));
});

// Create wishlist item
wishlistRouter.post('/', (req, res) => {
  const userId = (req as any).userId as string;
  const id = uuid();
  const now = new Date().toISOString();
  const { title, description = '', type = 'idea', createdByName = '' } = req.body;

  db.prepare(`
    INSERT INTO wishlist_items (id, title, description, type, status, user_id, created_by_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)
  `).run(id, title, description, type, userId, createdByName, now, now);

  res.status(201).json({ id });
});

// Update wishlist item
wishlistRouter.put('/:id', (req, res) => {
  const userId = (req as any).userId as string;
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM wishlist_items WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!existing) return res.status(404).json({ error: 'Wishlist item not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    const col = camelToSnake(key);
    fields.push(`${col} = ?`);
    values.push(value);
  }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(req.params.id);

  db.prepare(`UPDATE wishlist_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Toggle status (any user can toggle — shared wishlist)
wishlistRouter.put('/:id/toggle', (req, res) => {
  const now = new Date().toISOString();
  const item = db.prepare('SELECT * FROM wishlist_items WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!item) return res.status(404).json({ error: 'Wishlist item not found' });

  const newStatus = item.status === 'open' ? 'done' : 'open';
  db.prepare('UPDATE wishlist_items SET status = ?, updated_at = ? WHERE id = ?')
    .run(newStatus, now, req.params.id);
  res.json({ ok: true, status: newStatus });
});

// Delete wishlist item
wishlistRouter.delete('/:id', (req, res) => {
  const userId = (req as any).userId as string;
  db.prepare('DELETE FROM wishlist_items WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.json({ ok: true });
});
