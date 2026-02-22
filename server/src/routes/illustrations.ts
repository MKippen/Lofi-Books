import { Router } from 'express';
import { db } from '../db.js';
import { camelToSnake } from '../util.js';

export const illustrationsRouter = Router();

// Update illustration (e.g. change caption)
illustrationsRouter.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM chapter_illustrations WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Illustration not found' });

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

  db.prepare(`UPDATE chapter_illustrations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Delete illustration
illustrationsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM chapter_illustrations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
