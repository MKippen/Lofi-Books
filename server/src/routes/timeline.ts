import { Router } from 'express';
import { execute, queryRow } from '../db.js';
import { asyncHandler } from '../http.js';
import { camelToSnake } from '../util.js';

export const timelineRouter = Router();

const ALLOWED_FIELDS = new Set([
  'title', 'description', 'chapterId', 'characterIds',
  'eventType', 'sortOrder', 'color',
]);

async function findOwnedEvent(req: any): Promise<Record<string, unknown> | null> {
  const userId = req.userId as string;
  const row = await queryRow(
    `SELECT te.* FROM timeline_events te
     JOIN books b ON b.id = te.book_id
     WHERE te.id = $1 AND b.user_id = $2`,
    [req.params.id, userId],
  ) as Record<string, unknown> | null;
  return row;
}

timelineRouter.put('/:id', asyncHandler(async (req, res) => {
  const now = new Date().toISOString();
  const existing = await findOwnedEvent(req);
  if (!existing) return res.status(404).json({ error: 'Timeline event not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    values.push(Array.isArray(value) ? JSON.stringify(value) : value);
    fields.push(`${camelToSnake(key)} = $${values.length}`);
  }
  fields.push(`updated_at = $${values.length + 1}`);
  values.push(now, req.params.id);

  await execute(`UPDATE timeline_events SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
  res.json({ ok: true });
}));

timelineRouter.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await findOwnedEvent(req);
  if (!existing) return res.status(404).json({ error: 'Timeline event not found' });
  await execute('DELETE FROM timeline_events WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));
