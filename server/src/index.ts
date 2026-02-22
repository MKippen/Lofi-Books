import express from 'express';
import cors from 'cors';
import { booksRouter } from './routes/books.js';
import { charactersRouter } from './routes/characters.js';
import { chaptersRouter } from './routes/chapters.js';
import { ideasRouter } from './routes/ideas.js';
import { connectionsRouter } from './routes/connections.js';
import { illustrationsRouter } from './routes/illustrations.js';
import { timelineRouter } from './routes/timeline.js';
import { wishlistRouter } from './routes/wishlist.js';
import { imagesRouter } from './routes/images.js';
import { backupRouter } from './routes/backup.js';
import { aiRouter } from './routes/ai.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Extract user ID from X-User-Id header and attach to request
app.use((req, _res, next) => {
  (req as any).userId = req.headers['x-user-id'] as string || '';
  next();
});

// Request logging (non-GET to reduce noise)
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    });
  }
  next();
});

// Routes
app.use('/api/books', booksRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/chapters', chaptersRouter);
app.use('/api/ideas', ideasRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/illustrations', illustrationsRouter);
app.use('/api/timeline', timelineRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/images', imagesRouter);
app.use('/api/backup', backupRouter);
app.use('/api/ai', aiRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lofi Books API running on port ${PORT}`);
});
