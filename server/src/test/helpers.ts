import express from 'express';
import { booksRouter } from '../routes/books.js';
import { charactersRouter } from '../routes/characters.js';
import { chaptersRouter } from '../routes/chapters.js';
import { ideasRouter } from '../routes/ideas.js';
import { connectionsRouter } from '../routes/connections.js';
import { illustrationsRouter } from '../routes/illustrations.js';
import { timelineRouter } from '../routes/timeline.js';
import { wishlistRouter } from '../routes/wishlist.js';
import { imagesRouter } from '../routes/images.js';

/**
 * Creates a test Express app with all routes mounted, plus middleware
 * that reads X-User-Id from the request header (just like production).
 */
export function createTestApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // Extract user ID from X-User-Id header (same as production)
  app.use((req, _res, next) => {
    (req as any).userId = req.headers['x-user-id'] as string || '';
    next();
  });

  // Mount routes
  app.use('/api/books', booksRouter);
  app.use('/api/characters', charactersRouter);
  app.use('/api/chapters', chaptersRouter);
  app.use('/api/ideas', ideasRouter);
  app.use('/api/connections', connectionsRouter);
  app.use('/api/illustrations', illustrationsRouter);
  app.use('/api/timeline', timelineRouter);
  app.use('/api/wishlist', wishlistRouter);
  app.use('/api/images', imagesRouter);

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Test error:', err);
    res.status(500).json({ error: err.message });
  });

  return app;
}

/**
 * Seed a book for a specific user. Returns the book ID.
 */
export async function seedBook(
  app: express.Express,
  userId: string,
  title = 'Test Book',
): Promise<string> {
  const supertest = (await import('supertest')).default;
  const res = await supertest(app)
    .post('/api/books')
    .set('X-User-Id', userId)
    .send({ title, description: 'Test description' });
  return res.body.id;
}

/**
 * Seed a chapter under a book. Returns the chapter ID.
 */
export async function seedChapter(
  app: express.Express,
  userId: string,
  bookId: string,
  title = 'Test Chapter',
): Promise<string> {
  const supertest = (await import('supertest')).default;
  const res = await supertest(app)
    .post(`/api/books/${bookId}/chapters`)
    .set('X-User-Id', userId)
    .send({ title });
  return res.body.id;
}

/**
 * Seed a character under a book. Returns the character ID.
 */
export async function seedCharacter(
  app: express.Express,
  userId: string,
  bookId: string,
  name = 'Test Character',
): Promise<string> {
  const supertest = (await import('supertest')).default;
  const res = await supertest(app)
    .post(`/api/books/${bookId}/characters`)
    .set('X-User-Id', userId)
    .send({ name });
  return res.body.id;
}

/**
 * Seed an idea (sticky note) under a book. Returns the idea ID.
 */
export async function seedIdea(
  app: express.Express,
  userId: string,
  bookId: string,
  title = 'Test Idea',
): Promise<string> {
  const supertest = (await import('supertest')).default;
  const res = await supertest(app)
    .post(`/api/books/${bookId}/ideas`)
    .set('X-User-Id', userId)
    .send({ title, type: 'note' });
  return res.body.id;
}

/**
 * Seed a timeline event under a book. Returns the event ID.
 */
export async function seedTimelineEvent(
  app: express.Express,
  userId: string,
  bookId: string,
  title = 'Test Event',
): Promise<string> {
  const supertest = (await import('supertest')).default;
  const res = await supertest(app)
    .post(`/api/books/${bookId}/timeline`)
    .set('X-User-Id', userId)
    .send({ title, eventType: 'plot' });
  return res.body.id;
}

/**
 * Seed a connection between two ideas. Returns the connection ID.
 */
export async function seedConnection(
  app: express.Express,
  userId: string,
  bookId: string,
  fromIdeaId: string,
  toIdeaId: string,
): Promise<string> {
  const supertest = (await import('supertest')).default;
  const res = await supertest(app)
    .post(`/api/books/${bookId}/connections`)
    .set('X-User-Id', userId)
    .send({ fromIdeaId, toIdeaId });
  return res.body.id;
}

/**
 * Seed a chapter illustration. Returns the illustration ID.
 */
export async function seedIllustration(
  app: express.Express,
  userId: string,
  bookId: string,
  chapterId: string,
): Promise<string> {
  const supertest = (await import('supertest')).default;
  const res = await supertest(app)
    .post(`/api/books/${bookId}/chapters/${chapterId}/illustrations`)
    .set('X-User-Id', userId)
    .send({ imageId: 'test-img-id', caption: 'Test illustration' });
  return res.body.id;
}
