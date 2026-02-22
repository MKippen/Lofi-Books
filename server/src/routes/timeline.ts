import { Router } from 'express';
import { db } from '../db.js';
import { camelToSnake } from '../util.js';

export const timelineRouter = Router();

// Update timeline event
timelineRouter.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Timeline event not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
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
  db.prepare('DELETE FROM timeline_events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
