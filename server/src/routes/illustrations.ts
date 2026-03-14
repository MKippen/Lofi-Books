import { Router } from 'express';
import { execute, queryRow } from '../db.js';
import { asyncHandler } from '../http.js';
import { camelToSnake } from '../util.js';

export const illustrationsRouter = Router();

const ALLOWED_FIELDS = new Set(['caption', 'sortOrder']);

async function findOwnedIllustration(req: any): Promise<Record<string, unknown> | null> {
  const userId = req.userId as string;
  const row = await queryRow(
    `SELECT ci.* FROM chapter_illustrations ci
     JOIN books b ON b.id = ci.book_id
     WHERE ci.id = $1 AND b.user_id = $2`,
    [req.params.id, userId],
  ) as Record<string, unknown> | null;
  return row;
}

illustrationsRouter.put('/:id', asyncHandler(async (req, res) => {
  const now = new Date().toISOString();
  const existing = await findOwnedIllustration(req);
  if (!existing) return res.status(404).json({ error: 'Illustration not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    values.push(value);
    fields.push(`${camelToSnake(key)} = $${values.length}`);
  }
  fields.push(`updated_at = $${values.length + 1}`);
  values.push(now, req.params.id);

  await execute(`UPDATE chapter_illustrations SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
  res.json({ ok: true });
}));

illustrationsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await findOwnedIllustration(req);
  if (!existing) return res.status(404).json({ error: 'Illustration not found' });
  await execute('DELETE FROM chapter_illustrations WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));
