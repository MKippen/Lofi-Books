import { Router } from 'express';
import { db } from '../db.js';
import { camelToSnake } from '../util.js';

export const ideasRouter = Router();

const ALLOWED_FIELDS = new Set([
  'title', 'description', 'imageId', 'color',
  'positionX', 'positionY', 'width', 'height',
  'zIndex', 'linkedChapterId', 'type',
]);

// Helper: find idea and verify ownership through book → user_id
function findOwnedIdea(req: any): Record<string, unknown> | null {
  const userId = req.userId as string;
  const row = db.prepare(`
    SELECT i.* FROM ideas i
    JOIN books b ON b.id = i.book_id
    WHERE i.id = ? AND b.user_id = ?
  `).get(req.params.id, userId) as Record<string, unknown> | undefined;
  return row ?? null;
}

// Update idea
ideasRouter.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const existing = findOwnedIdea(req);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

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

  db.prepare(`UPDATE ideas SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Delete idea
ideasRouter.delete('/:id', (req, res) => {
  const existing = findOwnedIdea(req);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });
  db.prepare('DELETE FROM ideas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Bring to front (z-index)
ideasRouter.put('/:id/bring-to-front', (req, res) => {
  const now = new Date().toISOString();
  const idea = findOwnedIdea(req);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });

  const maxRow = db.prepare(
    'SELECT MAX(z_index) as max_z FROM ideas WHERE book_id = ?'
  ).get(idea.book_id) as { max_z: number | null };
  const newZ = (maxRow?.max_z ?? 0) + 1;

  db.prepare('UPDATE ideas SET z_index = ?, updated_at = ? WHERE id = ?')
    .run(newZ, now, req.params.id);
  res.json({ ok: true });
});
