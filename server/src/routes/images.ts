import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db, IMAGES_DIR } from '../db.js';

export const imagesRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
    filename: (_req, file, cb) => {
      const id = uuid();
      const ext = extFromMime(file.mimetype);
      // Store the id in the request for later use
      (_req as unknown as Record<string, string>).__imageId = id;
      (_req as unknown as Record<string, string>).__imageExt = ext;
      cb(null, `${id}.${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Upload image
imagesRouter.post('/upload/:bookId', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const id = (req as unknown as Record<string, string>).__imageId;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO images (id, book_id, filename, mime_type, size, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.bookId, req.file.originalname, req.file.mimetype, req.file.size, now);

  res.status(201).json({ id, url: `/api/images/${id}` });
});

// Serve image file
imagesRouter.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: 'Image not found' });

  const ext = extFromMime(row.mime_type as string);
  const filePath = path.join(IMAGES_DIR, `${req.params.id}.${ext}`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image file not found' });
  }

  res.setHeader('Content-Type', row.mime_type as string);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(filePath);
});

// Delete image
imagesRouter.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (row) {
    const ext = extFromMime(row.mime_type as string);
    const filePath = path.join(IMAGES_DIR, `${req.params.id}.${ext}`);
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    db.prepare('DELETE FROM images WHERE id = ?').run(req.params.id);
  }
  res.json({ ok: true });
});

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/svg+xml': 'svg',
  };
  return map[mime] || 'bin';
}
