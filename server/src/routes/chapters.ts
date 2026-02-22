import { Router } from 'express';
import { db } from '../db.js';
import { toCamel, camelToSnake } from '../util.js';

export const chaptersRouter = Router();

// Get single chapter
chaptersRouter.get('/:id', (req, res) => {
  const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
  res.json(toCamel(chapter as Record<string, unknown>));
});

// Update chapter
chaptersRouter.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM chapters WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Chapter not found' });

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

  db.prepare(`UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Delete chapter
chaptersRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM chapters WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
