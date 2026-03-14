import { Router } from 'express';
import { execute, IMAGES_DIR, queryRow } from '../db.js';
import { asyncHandler } from '../http.js';
import { toCamel, camelToSnake } from '../util.js';
import fs from 'fs';
import path from 'path';

export const charactersRouter = Router();

const ALLOWED_FIELDS = new Set([
  'name', 'mainImageId', 'backstory', 'development',
  'personalityTraits', 'relationships', 'specialAbilities', 'role', 'sortOrder',
]);

async function findOwnedCharacter(req: any): Promise<Record<string, unknown> | null> {
  const userId = req.userId as string;
  const row = await queryRow(
    `SELECT ch.* FROM characters ch
     JOIN books b ON b.id = ch.book_id
     WHERE ch.id = $1 AND b.user_id = $2`,
    [req.params.id, userId],
  ) as Record<string, unknown> | null;
  return row;
}

charactersRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await findOwnedCharacter(req);
  if (!row) return res.status(404).json({ error: 'Character not found' });
  res.json(parseCharacterRow(row));
}));

charactersRouter.put('/:id', asyncHandler(async (req, res) => {
  const now = new Date().toISOString();
  const existing = await findOwnedCharacter(req);
  if (!existing) return res.status(404).json({ error: 'Character not found' });

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    values.push(Array.isArray(value) ? JSON.stringify(value) : value);
    fields.push(`${camelToSnake(key)} = $${values.length}`);
  }
  fields.push(`updated_at = $${values.length + 1}`);
  values.push(now, req.params.id);

  await execute(`UPDATE characters SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
  res.json({ ok: true });
}));

charactersRouter.delete('/:id', asyncHandler(async (req, res) => {
  const char = await findOwnedCharacter(req);
  if (!char) return res.status(404).json({ error: 'Character not found' });

  if (char.main_image_id) {
    const imgId = char.main_image_id as string;
    const imgRow = await queryRow('SELECT * FROM images WHERE id = $1', [imgId]) as Record<string, unknown> | null;
    if (imgRow) {
      const ext = extFromMime(imgRow.mime_type as string);
      const filePath = path.join(IMAGES_DIR, `${imgId}.${ext}`);
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      await execute('DELETE FROM images WHERE id = $1', [imgId]);
    }
  }

  await execute('DELETE FROM characters WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

function parseCharacterRow(row: Record<string, unknown>) {
  const c = toCamel(row) as Record<string, unknown>;
  return {
    ...c,
    personalityTraits: JSON.parse((c.personalityTraits as string) || '[]'),
    relationships: JSON.parse((c.relationships as string) || '[]'),
    specialAbilities: JSON.parse((c.specialAbilities as string) || '[]'),
  };
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/svg+xml': 'svg',
  };
  return map[mime] || 'bin';
}
