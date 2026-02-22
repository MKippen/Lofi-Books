import { Router } from 'express';
import { db } from '../db.js';
import { camelToSnake } from '../util.js';

export const illustrationsRouter = Router();

const ALLOWED_FIELDS = new Set(['caption', 'sortOrder']);

// Helper: find illustration and verify ownership through book → user_id
function findOwnedIllustration(req: any): Record<string, unknown> | null {
  const userId = req.userId as string;
  const row = db.prepare(`
    SELECT ci.* FROM chapter_illustrations ci
    JOIN books b ON b.id = ci.book_id
    WHERE ci.id = ? AND b.user_id = ?
  `).get(req.params.id, userId) as Record<string, unknown> | undefined;
  return row ?? null;
}

// Update illustration (e.g. change caption)
illustrationsRouter.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const existing = findOwnedIllustration(req);
  if (!existing) return res.status(404).json({ error: 'Illustration not found' });

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

  db.prepare(`UPDATE chapter_illustrations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Delete illustration
illustrationsRouter.delete('/:id', (req, res) => {
  const existing = findOwnedIllustration(req);
  if (!existing) return res.status(404).json({ error: 'Illustration not found' });
  db.prepare('DELETE FROM chapter_illustrations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
