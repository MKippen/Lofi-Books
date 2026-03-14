import { Router } from 'express';
import { execute, queryRow } from '../db.js';
import { asyncHandler } from '../http.js';
import { camelToSnake } from '../util.js';

export const connectionsRouter = Router();

const ALLOWED_FIELDS = new Set(['color']);

async function findOwnedConnection(req: any): Promise<Record<string, unknown> | null> {
  const userId = req.userId as string;
  const row = await queryRow(
    `SELECT c.* FROM connections c
     JOIN books b ON b.id = c.book_id
     WHERE c.id = $1 AND b.user_id = $2`,
    [req.params.id, userId],
  ) as Record<string, unknown> | null;
  return row;
}

connectionsRouter.put('/:id', asyncHandler(async (req, res) => {
  const now = new Date().toISOString();
  const existing = await findOwnedConnection(req);
  if (!existing) return res.status(404).json({ error: 'Connection not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    values.push(value);
    fields.push(`${camelToSnake(key)} = $${values.length}`);
  }
  fields.push(`updated_at = $${values.length + 1}`);
  values.push(now, req.params.id);

  await execute(`UPDATE connections SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
  res.json({ ok: true });
}));

connectionsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await findOwnedConnection(req);
  if (!existing) return res.status(404).json({ error: 'Connection not found' });
  await execute('DELETE FROM connections WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));
