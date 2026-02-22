import { Router } from 'express';
import { db } from '../db.js';
import { camelToSnake } from '../util.js';

export const connectionsRouter = Router();

const ALLOWED_FIELDS = new Set(['color']);

// Helper: find connection and verify ownership through book → user_id
function findOwnedConnection(req: any): Record<string, unknown> | null {
  const userId = req.userId as string;
  const row = db.prepare(`
    SELECT c.* FROM connections c
    JOIN books b ON b.id = c.book_id
    WHERE c.id = ? AND b.user_id = ?
  `).get(req.params.id, userId) as Record<string, unknown> | undefined;
  return row ?? null;
}

// Update connection (e.g. change color)
connectionsRouter.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const existing = findOwnedConnection(req);
  if (!existing) return res.status(404).json({ error: 'Connection not found' });

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

  db.prepare(`UPDATE connections SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Delete connection
connectionsRouter.delete('/:id', (req, res) => {
  const existing = findOwnedConnection(req);
  if (!existing) return res.status(404).json({ error: 'Connection not found' });
  db.prepare('DELETE FROM connections WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
