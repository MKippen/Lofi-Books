import { Router } from 'express';
import { execute, queryRow, queryValue } from '../db.js';
import { asyncHandler } from '../http.js';
import { camelToSnake } from '../util.js';

export const ideasRouter = Router();

const ALLOWED_FIELDS = new Set([
  'title', 'description', 'imageId', 'color',
  'positionX', 'positionY', 'width', 'height',
  'zIndex', 'linkedChapterId', 'type',
]);

async function findOwnedIdea(req: any): Promise<Record<string, unknown> | null> {
  const userId = req.userId as string;
  const row = await queryRow(
    `SELECT i.* FROM ideas i
     JOIN books b ON b.id = i.book_id
     WHERE i.id = $1 AND b.user_id = $2`,
    [req.params.id, userId],
  ) as Record<string, unknown> | null;
  return row;
}

ideasRouter.put('/:id', asyncHandler(async (req, res) => {
  const now = new Date().toISOString();
  const existing = await findOwnedIdea(req);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    values.push(value);
    fields.push(`${camelToSnake(key)} = $${values.length}`);
  }
  fields.push(`updated_at = $${values.length + 1}`);
  values.push(now, req.params.id);

  await execute(`UPDATE ideas SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
  res.json({ ok: true });
}));

ideasRouter.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await findOwnedIdea(req);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });
  await execute('DELETE FROM ideas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

ideasRouter.put('/:id/bring-to-front', asyncHandler(async (req, res) => {
  const now = new Date().toISOString();
  const idea = await findOwnedIdea(req);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });

  const newZ = Number(await queryValue(
    'SELECT COALESCE(MAX(z_index), 0)::bigint + 1 AS next_z FROM ideas WHERE book_id = $1',
    [idea.book_id],
  ) || 1);

  await execute('UPDATE ideas SET z_index = $1, updated_at = $2 WHERE id = $3', [newZ, now, req.params.id]);
  res.json({ ok: true });
}));
