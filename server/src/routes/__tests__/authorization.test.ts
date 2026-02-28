import { describe, it, expect, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import { createTestApp, seedBook, seedChapter, seedCharacter, seedIdea, seedTimelineEvent, seedConnection, seedIllustration } from '../../test/helpers.js';

vi.mock('../../db.js', async () => import('../../test/testDb.js'));

const USER_A = 'user-a-id';
const USER_B = 'user-b-id';

describe('Authorization — cross-user data isolation', () => {
  let app: ReturnType<typeof createTestApp>;
  let bookA: string;
  let chapterA: string;
  let characterA: string;
  let ideaA1: string;
  let ideaA2: string;
  let connectionA: string;
  let timelineA: string;
  let illustrationA: string;

  beforeEach(async () => {
    app = createTestApp();

    // Seed data for user A
    bookA = await seedBook(app, USER_A, 'User A Book');
    chapterA = await seedChapter(app, USER_A, bookA, 'Chapter 1');
    characterA = await seedCharacter(app, USER_A, bookA, 'Hero');
    ideaA1 = await seedIdea(app, USER_A, bookA, 'Idea 1');
    ideaA2 = await seedIdea(app, USER_A, bookA, 'Idea 2');
    connectionA = await seedConnection(app, USER_A, bookA, ideaA1, ideaA2);
    timelineA = await seedTimelineEvent(app, USER_A, bookA, 'Event 1');
    illustrationA = await seedIllustration(app, USER_A, bookA, chapterA);
  });

  // --- Books ---
  it('user B cannot list user A books', async () => {
    const res = await supertest(app)
      .get('/api/books')
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]); // user B has no books
  });

  it('user B cannot get user A book by ID', async () => {
    const res = await supertest(app)
      .get(`/api/books/${bookA}`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  it('user B cannot update user A book', async () => {
    const res = await supertest(app)
      .put(`/api/books/${bookA}`)
      .set('X-User-Id', USER_B)
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('user B cannot delete user A book', async () => {
    await supertest(app)
      .delete(`/api/books/${bookA}`)
      .set('X-User-Id', USER_B);
    // Book should still exist for user A
    const res = await supertest(app)
      .get(`/api/books/${bookA}`)
      .set('X-User-Id', USER_A);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('User A Book');
  });

  // --- Nested book routes: user B should not access user A's book children ---
  it('user B cannot list user A book chapters', async () => {
    const res = await supertest(app)
      .get(`/api/books/${bookA}/chapters`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  it('user B cannot create a chapter in user A book', async () => {
    const res = await supertest(app)
      .post(`/api/books/${bookA}/chapters`)
      .set('X-User-Id', USER_B)
      .send({ title: 'Sneaky Chapter' });
    expect(res.status).toBe(404);
  });

  it('user B cannot list user A book characters', async () => {
    const res = await supertest(app)
      .get(`/api/books/${bookA}/characters`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  it('user B cannot list user A book ideas', async () => {
    const res = await supertest(app)
      .get(`/api/books/${bookA}/ideas`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  it('user B cannot list user A book connections', async () => {
    const res = await supertest(app)
      .get(`/api/books/${bookA}/connections`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  it('user B cannot list user A book timeline', async () => {
    const res = await supertest(app)
      .get(`/api/books/${bookA}/timeline`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  // --- Standalone routes: user B should not access user A's entities ---
  it('user B cannot GET user A chapter', async () => {
    const res = await supertest(app)
      .get(`/api/chapters/${chapterA}`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  it('user B cannot UPDATE user A chapter', async () => {
    const res = await supertest(app)
      .put(`/api/chapters/${chapterA}`)
      .set('X-User-Id', USER_B)
      .send({ title: 'Hijacked Chapter' });
    expect(res.status).toBe(404);
  });

  it('user B cannot DELETE user A chapter', async () => {
    const res = await supertest(app)
      .delete(`/api/chapters/${chapterA}`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);

    // Verify it still exists for user A
    const check = await supertest(app)
      .get(`/api/chapters/${chapterA}`)
      .set('X-User-Id', USER_A);
    expect(check.status).toBe(200);
  });

  it('user B cannot GET user A character', async () => {
    const res = await supertest(app)
      .get(`/api/characters/${characterA}`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  it('user B cannot UPDATE user A character', async () => {
    const res = await supertest(app)
      .put(`/api/characters/${characterA}`)
      .set('X-User-Id', USER_B)
      .send({ name: 'Villain' });
    expect(res.status).toBe(404);
  });

  it('user B cannot DELETE user A character', async () => {
    const res = await supertest(app)
      .delete(`/api/characters/${characterA}`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);

    // Still exists for user A
    const check = await supertest(app)
      .get(`/api/characters/${characterA}`)
      .set('X-User-Id', USER_A);
    expect(check.status).toBe(200);
  });

  it('user B cannot UPDATE user A idea', async () => {
    const res = await supertest(app)
      .put(`/api/ideas/${ideaA1}`)
      .set('X-User-Id', USER_B)
      .send({ title: 'Stolen Idea' });
    expect(res.status).toBe(404);
  });

  it('user B cannot DELETE user A idea', async () => {
    const res = await supertest(app)
      .delete(`/api/ideas/${ideaA1}`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  it('user B cannot UPDATE user A connection', async () => {
    const res = await supertest(app)
      .put(`/api/connections/${connectionA}`)
      .set('X-User-Id', USER_B)
      .send({ color: 'blue' });
    expect(res.status).toBe(404);
  });

  it('user B cannot DELETE user A connection', async () => {
    const res = await supertest(app)
      .delete(`/api/connections/${connectionA}`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  it('user B cannot UPDATE user A timeline event', async () => {
    const res = await supertest(app)
      .put(`/api/timeline/${timelineA}`)
      .set('X-User-Id', USER_B)
      .send({ title: 'Stolen Event' });
    expect(res.status).toBe(404);
  });

  it('user B cannot DELETE user A timeline event', async () => {
    const res = await supertest(app)
      .delete(`/api/timeline/${timelineA}`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  it('user B cannot UPDATE user A illustration', async () => {
    const res = await supertest(app)
      .put(`/api/illustrations/${illustrationA}`)
      .set('X-User-Id', USER_B)
      .send({ caption: 'Stolen' });
    expect(res.status).toBe(404);
  });

  it('user B cannot DELETE user A illustration', async () => {
    const res = await supertest(app)
      .delete(`/api/illustrations/${illustrationA}`)
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(404);
  });

  // --- Wishlist shared list, but edit/delete restricted to owner ---
  it('user B CAN see user A wishlist items (shared)', async () => {
    // Create a wishlist item for user A
    await supertest(app)
      .post('/api/wishlist')
      .set('X-User-Id', USER_A)
      .send({ title: 'A wants this' });

    const res = await supertest(app)
      .get('/api/wishlist')
      .set('X-User-Id', USER_B);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('A wants this');
  });
});
