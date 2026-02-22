import { Router } from 'express';
import { db } from '../db.js';
import { camelToSnake } from '../util.js';

export const ideasRouter = Router();

// Update idea
ideasRouter.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Idea not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
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
  db.prepare('DELETE FROM ideas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Bring to front (z-index)
ideasRouter.put('/:id/bring-to-front', (req, res) => {
  const now = new Date().toISOString();
  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!idea) return res.status(404).json({ error: 'Idea not found' });

  const maxRow = db.prepare(
    'SELECT MAX(z_index) as max_z FROM ideas WHERE book_id = ?'
  ).get(idea.book_id) as { max_z: number | null };
  const newZ = (maxRow?.max_z ?? 0) + 1;

  db.prepare('UPDATE ideas SET z_index = ?, updated_at = ? WHERE id = ?')
    .run(newZ, now, req.params.id);
  res.json({ ok: true });
});
