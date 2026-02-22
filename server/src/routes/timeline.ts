import { Router } from 'express';
import { db } from '../db.js';
import { camelToSnake } from '../util.js';

export const timelineRouter = Router();

const ALLOWED_FIELDS = new Set([
  'title', 'description', 'chapterId', 'characterIds',
  'eventType', 'sortOrder', 'color',
]);

// Helper: find timeline event and verify ownership through book → user_id
function findOwnedEvent(req: any): Record<string, unknown> | null {
  const userId = req.userId as string;
  const row = db.prepare(`
    SELECT te.* FROM timeline_events te
    JOIN books b ON b.id = te.book_id
    WHERE te.id = ? AND b.user_id = ?
  `).get(req.params.id, userId) as Record<string, unknown> | undefined;
  return row ?? null;
}

// Update timeline event
timelineRouter.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const existing = findOwnedEvent(req);
  if (!existing) return res.status(404).json({ error: 'Timeline event not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    const col = camelToSnake(key);
    fields.push(`${col} = ?`);
    values.push(Array.isArray(value) ? JSON.stringify(value) : value);
  }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(req.params.id);

  db.prepare(`UPDATE timeline_events SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Delete timeline event
timelineRouter.delete('/:id', (req, res) => {
  const existing = findOwnedEvent(req);
  if (!existing) return res.status(404).json({ error: 'Timeline event not found' });
  db.prepare('DELETE FROM timeline_events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
