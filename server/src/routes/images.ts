import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { execute, IMAGES_DIR, queryRow } from '../db.js';
import { asyncHandler } from '../http.js';

export const imagesRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
    filename: (_req, file, cb) => {
      const id = uuid();
      const ext = extFromMime(file.mimetype);
      (_req as unknown as Record<string, string>).__imageId = id;
      cb(null, `${id}.${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

imagesRouter.post('/upload/:bookId', upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const userId = (req as any).userId as string;
  const ownedBook = await queryRow('SELECT id FROM books WHERE id = $1 AND user_id = $2', [req.params.bookId, userId]);
  if (!ownedBook) {
    deleteStoredFile(req.file.filename);
    return res.status(404).json({ error: 'Book not found' });
  }

  const id = (req as unknown as Record<string, string>).__imageId;
  const now = new Date().toISOString();

  await execute(
    `INSERT INTO images (id, book_id, filename, mime_type, size, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, req.params.bookId, req.file.originalname, req.file.mimetype, req.file.size, now],
  );

  res.status(201).json({ id, url: `/api/images/${id}` });
}));

imagesRouter.get('/:id', asyncHandler(async (req, res) => {
  const row = await queryRow('SELECT * FROM images WHERE id = $1', [req.params.id]) as Record<string, unknown> | null;
  if (!row) return res.status(404).json({ error: 'Image not found' });

  const ext = extFromMime(row.mime_type as string);
  const filePath = path.join(IMAGES_DIR, `${req.params.id}.${ext}`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image file not found' });
  }

  res.setHeader('Content-Type', row.mime_type as string);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(filePath);
}));

imagesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const userId = (req as any).userId as string;
  const row = await queryRow(
    `SELECT i.* FROM images i
     JOIN books b ON b.id = i.book_id
     WHERE i.id = $1 AND b.user_id = $2`,
    [req.params.id, userId],
  ) as Record<string, unknown> | null;
  if (row) {
    const ext = extFromMime(row.mime_type as string);
    const filePath = path.join(IMAGES_DIR, `${req.params.id}.${ext}`);
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    await execute('DELETE FROM images WHERE id = $1', [req.params.id]);
  }
  res.json({ ok: true });
}));

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/svg+xml': 'svg',
  };
  return map[mime] || 'bin';
}

function deleteStoredFile(filename: string) {
  try {
    fs.unlinkSync(path.join(IMAGES_DIR, filename));
  } catch {
    // best-effort cleanup
  }
}
