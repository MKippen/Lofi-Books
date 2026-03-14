import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { execute, queryRow, queryRows } from '../db.js';
import { asyncHandler } from '../http.js';
import { toCamelArray, camelToSnake } from '../util.js';

export const wishlistRouter = Router();

const ALLOWED_FIELDS = new Set(['title', 'description', 'type', 'status']);

wishlistRouter.get('/', asyncHandler(async (_req, res) => {
  const items = await queryRows('SELECT * FROM wishlist_items ORDER BY created_at DESC');
  res.json(toCamelArray(items as Record<string, unknown>[]));
}));

wishlistRouter.post('/', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  const id = uuid();
  const now = new Date().toISOString();
  const { title, description = '', type = 'idea', createdByName = '' } = req.body;

  await execute(
    `INSERT INTO wishlist_items (id, title, description, type, status, user_id, created_by_name, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8)`,
    [id, title, description, type, userId, createdByName, now, now],
  );

  res.status(201).json({ id });
}));

wishlistRouter.put('/:id', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  const now = new Date().toISOString();
  const existing = await queryRow('SELECT * FROM wishlist_items WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
  if (!existing) return res.status(404).json({ error: 'Wishlist item not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    values.push(value);
    fields.push(`${camelToSnake(key)} = $${values.length}`);
  }
  fields.push(`updated_at = $${values.length + 1}`);
  values.push(now, req.params.id);

  await execute(`UPDATE wishlist_items SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
  res.json({ ok: true });
}));

wishlistRouter.put('/:id/toggle', asyncHandler(async (req, res) => {
  const now = new Date().toISOString();
  const item = await queryRow('SELECT * FROM wishlist_items WHERE id = $1', [req.params.id]) as Record<string, unknown> | null;
  if (!item) return res.status(404).json({ error: 'Wishlist item not found' });

  const newStatus = item.status === 'open' ? 'done' : 'open';
  await execute('UPDATE wishlist_items SET status = $1, updated_at = $2 WHERE id = $3', [newStatus, now, req.params.id]);
  res.json({ ok: true, status: newStatus });
}));

wishlistRouter.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  await execute('DELETE FROM wishlist_items WHERE id = $1 AND user_id = $2', [req.params.id, userId]);
  res.json({ ok: true });
}));
