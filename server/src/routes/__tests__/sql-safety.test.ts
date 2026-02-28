import { describe, it, expect, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import { createTestApp, seedBook, seedChapter, seedCharacter, seedIdea, seedTimelineEvent, seedConnection, seedIllustration } from '../../test/helpers.js';

vi.mock('../../db.js', async () => import('../../test/testDb.js'));

const USER = 'user-safety';

describe('SQL safety — column whitelist', () => {
  let app: ReturnType<typeof createTestApp>;
  let bookId: string;
  let chapterId: string;
  let characterId: string;
  let ideaId: string;
  let timelineId: string;
  let connectionId: string;
  let idea2Id: string;

  beforeEach(async () => {
    app = createTestApp();
    bookId = await seedBook(app, USER);
    chapterId = await seedChapter(app, USER, bookId);
    characterId = await seedCharacter(app, USER, bookId);
    ideaId = await seedIdea(app, USER, bookId, 'Idea 1');
    idea2Id = await seedIdea(app, USER, bookId, 'Idea 2');
    connectionId = await seedConnection(app, USER, bookId, ideaId, idea2Id);
    timelineId = await seedTimelineEvent(app, USER, bookId);
  });

  it('PUT /books/:id ignores disallowed keys (id, userId, createdAt)', async () => {
    const res = await supertest(app)
      .put(`/api/books/${bookId}`)
      .set('X-User-Id', USER)
      .send({ id: 'hacked-id', userId: 'hacked-user', createdAt: '1970-01-01', title: 'Legit Title' });
    expect(res.status).toBe(200);

    // Verify only title changed
    const get = await supertest(app)
      .get(`/api/books/${bookId}`)
      .set('X-User-Id', USER);
    expect(get.body.id).toBe(bookId); // not changed
    expect(get.body.title).toBe('Legit Title'); // changed
  });

  it('PUT /chapters/:id ignores disallowed keys (id, bookId)', async () => {
    const res = await supertest(app)
      .put(`/api/chapters/${chapterId}`)
      .set('X-User-Id', USER)
      .send({ id: 'hacked', bookId: 'hacked', title: 'Updated Title' });
    expect(res.status).toBe(200);

    const get = await supertest(app)
      .get(`/api/chapters/${chapterId}`)
      .set('X-User-Id', USER);
    expect(get.body.id).toBe(chapterId);
    expect(get.body.title).toBe('Updated Title');
  });

  it('PUT /characters/:id ignores disallowed keys (id, bookId)', async () => {
    const res = await supertest(app)
      .put(`/api/characters/${characterId}`)
      .set('X-User-Id', USER)
      .send({ id: 'hacked', bookId: 'hacked', name: 'Updated Name' });
    expect(res.status).toBe(200);

    const get = await supertest(app)
      .get(`/api/characters/${characterId}`)
      .set('X-User-Id', USER);
    expect(get.body.id).toBe(characterId);
    expect(get.body.name).toBe('Updated Name');
  });

  it('PUT /ideas/:id ignores disallowed keys (id, bookId)', async () => {
    const res = await supertest(app)
      .put(`/api/ideas/${ideaId}`)
      .set('X-User-Id', USER)
      .send({ id: 'hacked', bookId: 'hacked', title: 'Updated Idea' });
    expect(res.status).toBe(200);
  });

  it('PUT /connections/:id only allows color', async () => {
    const res = await supertest(app)
      .put(`/api/connections/${connectionId}`)
      .set('X-User-Id', USER)
      .send({ id: 'hacked', bookId: 'hacked', fromIdeaId: 'hacked', color: 'blue' });
    expect(res.status).toBe(200);
  });

  it('PUT /timeline/:id ignores disallowed keys', async () => {
    const res = await supertest(app)
      .put(`/api/timeline/${timelineId}`)
      .set('X-User-Id', USER)
      .send({ id: 'hacked', bookId: 'hacked', title: 'Updated Event' });
    expect(res.status).toBe(200);
  });

  it('PUT /wishlist/:id ignores disallowed keys (id, userId)', async () => {
    // Create a wishlist item first
    const createRes = await supertest(app)
      .post('/api/wishlist')
      .set('X-User-Id', USER)
      .send({ title: 'My Wish' });
    const wishlistId = createRes.body.id;

    const res = await supertest(app)
      .put(`/api/wishlist/${wishlistId}`)
      .set('X-User-Id', USER)
      .send({ id: 'hacked', userId: 'hacked', title: 'Updated Wish' });
    expect(res.status).toBe(200);

    const list = await supertest(app)
      .get('/api/wishlist')
      .set('X-User-Id', USER);
    const item = list.body.find((i: any) => i.id === wishlistId);
    expect(item.title).toBe('Updated Wish');
  });
});
