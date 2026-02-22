import { Router } from 'express';
import { db, IMAGES_DIR } from '../db.js';
import { toCamel, camelToSnake } from '../util.js';
import fs from 'fs';
import path from 'path';

export const charactersRouter = Router();

const ALLOWED_FIELDS = new Set([
  'name', 'mainImageId', 'backstory', 'development',
  'personalityTraits', 'relationships', 'specialAbilities', 'role', 'sortOrder',
]);

// Helper: find character and verify ownership through book → user_id
function findOwnedCharacter(req: any): Record<string, unknown> | null {
  const userId = req.userId as string;
  const row = db.prepare(`
    SELECT ch.* FROM characters ch
    JOIN books b ON b.id = ch.book_id
    WHERE ch.id = ? AND b.user_id = ?
  `).get(req.params.id, userId) as Record<string, unknown> | undefined;
  return row ?? null;
}

// Get single character
charactersRouter.get('/:id', (req, res) => {
  const row = findOwnedCharacter(req);
  if (!row) return res.status(404).json({ error: 'Character not found' });
  res.json(parseCharacterRow(row));
});

// Update character
charactersRouter.put('/:id', (req, res) => {
  const now = new Date().toISOString();
  const existing = findOwnedCharacter(req);
  if (!existing) return res.status(404).json({ error: 'Character not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    const col = camelToSnake(key);
    if (Array.isArray(value)) {
      fields.push(`${col} = ?`);
      values.push(JSON.stringify(value));
    } else {
      fields.push(`${col} = ?`);
      values.push(value);
    }
  }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(req.params.id);

  db.prepare(`UPDATE characters SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Delete character + associated image
charactersRouter.delete('/:id', (req, res) => {
  const char = findOwnedCharacter(req);
  if (!char) return res.status(404).json({ error: 'Character not found' });

  if (char.main_image_id) {
    const imgId = char.main_image_id as string;
    const imgRow = db.prepare('SELECT * FROM images WHERE id = ?').get(imgId) as Record<string, unknown> | undefined;
    if (imgRow) {
      const ext = extFromMime(imgRow.mime_type as string);
      const filePath = path.join(IMAGES_DIR, `${imgId}.${ext}`);
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      db.prepare('DELETE FROM images WHERE id = ?').run(imgId);
    }
  }
  db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

function parseCharacterRow(row: Record<string, unknown>) {
  const c = toCamel(row) as Record<string, unknown>;
  return {
    ...c,
    personalityTraits: JSON.parse(c.personalityTraits as string || '[]'),
    relationships: JSON.parse(c.relationships as string || '[]'),
    specialAbilities: JSON.parse(c.specialAbilities as string || '[]'),
  };
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/svg+xml': 'svg',
  };
  return map[mime] || 'bin';
}
