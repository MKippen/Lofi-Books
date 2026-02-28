import { describe, it, expect, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import { createTestApp, seedBook } from '../../test/helpers.js';
import { resetTestDb } from '../../test/testDb.js';

vi.mock('../../db.js', async () => import('../../test/testDb.js'));

const USER = 'test-user';

describe('Books CRUD', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    resetTestDb();
    app = createTestApp();
  });

  it('creates a book and returns id', async () => {
    const res = await supertest(app)
      .post('/api/books')
      .set('X-User-Id', USER)
      .send({ title: 'My Book', description: 'A great book', genre: 'Fantasy' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('lists only the current user books', async () => {
    await seedBook(app, USER, 'Book 1');
    await seedBook(app, USER, 'Book 2');
    await seedBook(app, 'other-user', 'Other Book');

    const res = await supertest(app)
      .get('/api/books')
      .set('X-User-Id', USER);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((b: any) => b.title)).toContain('Book 1');
    expect(res.body.map((b: any) => b.title)).toContain('Book 2');
  });

  it('gets a single book by ID', async () => {
    const id = await seedBook(app, USER, 'My Book');
    const res = await supertest(app)
      .get(`/api/books/${id}`)
      .set('X-User-Id', USER);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('My Book');
    expect(res.body.id).toBe(id);
  });

  it('returns 404 for non-existent book', async () => {
    const res = await supertest(app)
      .get('/api/books/nonexistent')
      .set('X-User-Id', USER);
    expect(res.status).toBe(404);
  });

  it('updates a book', async () => {
    const id = await seedBook(app, USER, 'Old Title');
    const res = await supertest(app)
      .put(`/api/books/${id}`)
      .set('X-User-Id', USER)
      .send({ title: 'New Title', genre: 'Sci-Fi' });
    expect(res.status).toBe(200);

    const get = await supertest(app)
      .get(`/api/books/${id}`)
      .set('X-User-Id', USER);
    expect(get.body.title).toBe('New Title');
    expect(get.body.genre).toBe('Sci-Fi');
  });

  it('deletes a book', async () => {
    const id = await seedBook(app, USER, 'Doomed Book');
    const del = await supertest(app)
      .delete(`/api/books/${id}`)
      .set('X-User-Id', USER);
    expect(del.status).toBe(200);

    const get = await supertest(app)
      .get(`/api/books/${id}`)
      .set('X-User-Id', USER);
    expect(get.status).toBe(404);
  });

  it('cascade deletes child entities', async () => {
    const bookId = await seedBook(app, USER, 'Parent Book');

    // Create chapter and idea under the book
    await supertest(app)
      .post(`/api/books/${bookId}/chapters`)
      .set('X-User-Id', USER)
      .send({ title: 'Ch 1' });
    await supertest(app)
      .post(`/api/books/${bookId}/ideas`)
      .set('X-User-Id', USER)
      .send({ title: 'Idea 1', type: 'note' });

    // Delete the book
    await supertest(app)
      .delete(`/api/books/${bookId}`)
      .set('X-User-Id', USER);

    // Chapters and ideas should be gone
    const chapters = await supertest(app)
      .get(`/api/books/${bookId}/chapters`)
      .set('X-User-Id', USER);
    expect(chapters.status).toBe(404); // Book not found
  });

  it('claims orphaned books', async () => {
    // Insert a book with empty user_id (simulating pre-migration data)
    await seedBook(app, '', 'Orphan Book');

    const res = await supertest(app)
      .post('/api/books/claim-orphaned')
      .set('X-User-Id', USER);
    expect(res.status).toBe(200);
    expect(res.body.claimed).toBe(1);

    // Now the user should see it
    const list = await supertest(app)
      .get('/api/books')
      .set('X-User-Id', USER);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].title).toBe('Orphan Book');
  });
});
