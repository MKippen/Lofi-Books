import { Router } from 'express';
import { db } from '../db.js';
import { toCamel, camelToSnake } from '../util.js';

export const chaptersRouter = Router();

const ALLOWED_FIELDS = new Set([
  'title', 'content', 'sortOrder', 'wordCount', 'status', 'notes',
]);

// Helper: find chapter and verify ownership through book → user_id
function findOwnedChapter(req: any): Record<string, unknown> | null {
  const userId = req.userId as string;
  const row = db.prepare(`
    SELECT c.* FROM chapters c
    JOIN books b ON b.id = c.book_id
    WHERE c.id = ? AND b.user_id = ?
  `).get(req.params.id, userId) as Record<string, unknown> | undefined;
  return row ?? null;
}

// Get single chapter
chaptersRouter.get('/:id', (req, res) => {
  const chapter = findOwnedChapter(req);
  if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
  res.json(toCamel(chapter));
});

// Update chapter
chaptersRouter.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const existing = findOwnedChapter(req);
  if (!existing) return res.status(404).json({ error: 'Chapter not found' });

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

  db.prepare(`UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Delete chapter
chaptersRouter.delete('/:id', (req, res) => {
  const existing = findOwnedChapter(req);
  if (!existing) return res.status(404).json({ error: 'Chapter not found' });
  db.prepare('DELETE FROM chapters WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
