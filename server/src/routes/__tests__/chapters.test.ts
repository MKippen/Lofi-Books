import { describe, it, expect, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import { createTestApp, seedBook, seedChapter } from '../../test/helpers.js';

vi.mock('../../db.js', async () => import('../../test/testDb.js'));

const USER = 'test-user';

describe('Chapters CRUD', () => {
  let app: ReturnType<typeof createTestApp>;
  let bookId: string;

  beforeEach(async () => {
    app = createTestApp();
    bookId = await seedBook(app, USER, 'Test Book');
  });

  it('creates a chapter', async () => {
    const res = await supertest(app)
      .post(`/api/books/${bookId}/chapters`)
      .set('X-User-Id', USER)
      .send({ title: 'Chapter 1' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('lists chapters in sort order', async () => {
    await seedChapter(app, USER, bookId, 'Chapter 1');
    await seedChapter(app, USER, bookId, 'Chapter 2');
    await seedChapter(app, USER, bookId, 'Chapter 3');

    const res = await supertest(app)
      .get(`/api/books/${bookId}/chapters`)
      .set('X-User-Id', USER);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].title).toBe('Chapter 1');
    expect(res.body[2].title).toBe('Chapter 3');
  });

  it('gets a single chapter', async () => {
    const chapterId = await seedChapter(app, USER, bookId, 'My Chapter');
    const res = await supertest(app)
      .get(`/api/chapters/${chapterId}`)
      .set('X-User-Id', USER);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('My Chapter');
    expect(res.body.status).toBe('draft');
  });

  it('updates a chapter', async () => {
    const chapterId = await seedChapter(app, USER, bookId, 'Draft Chapter');
    const res = await supertest(app)
      .put(`/api/chapters/${chapterId}`)
      .set('X-User-Id', USER)
      .send({ title: 'Final Chapter', status: 'complete', content: '<p>Hello</p>' });
    expect(res.status).toBe(200);

    const get = await supertest(app)
      .get(`/api/chapters/${chapterId}`)
      .set('X-User-Id', USER);
    expect(get.body.title).toBe('Final Chapter');
    expect(get.body.status).toBe('complete');
    expect(get.body.content).toBe('<p>Hello</p>');
  });

  it('deletes a chapter', async () => {
    const chapterId = await seedChapter(app, USER, bookId, 'Doomed Chapter');
    const del = await supertest(app)
      .delete(`/api/chapters/${chapterId}`)
      .set('X-User-Id', USER);
    expect(del.status).toBe(200);

    const get = await supertest(app)
      .get(`/api/chapters/${chapterId}`)
      .set('X-User-Id', USER);
    expect(get.status).toBe(404);
  });

  it('reorders chapters', async () => {
    const c1 = await seedChapter(app, USER, bookId, 'A');
    const c2 = await seedChapter(app, USER, bookId, 'B');
    const c3 = await seedChapter(app, USER, bookId, 'C');

    // Reverse the order
    await supertest(app)
      .put(`/api/books/${bookId}/chapters/reorder`)
      .set('X-User-Id', USER)
      .send({ orderedIds: [c3, c2, c1] });

    const list = await supertest(app)
      .get(`/api/books/${bookId}/chapters`)
      .set('X-User-Id', USER);
    expect(list.body[0].title).toBe('C');
    expect(list.body[1].title).toBe('B');
    expect(list.body[2].title).toBe('A');
  });
});
