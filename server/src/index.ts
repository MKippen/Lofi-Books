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
import { requireAuth } from './middleware/auth.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS: allow only configured origins (env var) or localhost for local dev
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',')
  ?? ['http://localhost:5174', 'http://localhost:5173'];
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// JWT validation on all routes except /api/health.
// Skipped when MSAL_CLIENT_ID is not configured (local dev without env set).
app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  if (!process.env.MSAL_CLIENT_ID) return next();
  requireAuth(req, res, next);
});

// Extract user ID: prefer JWT claim set by requireAuth, fall back to X-User-Id header.
app.use((req, _res, next) => {
  if (!(req as any).userId) {
    (req as any).userId = req.headers['x-user-id'] as string || '';
  }
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
