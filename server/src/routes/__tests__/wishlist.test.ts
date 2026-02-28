import { describe, it, expect, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import { createTestApp } from '../../test/helpers.js';
import { resetTestDb } from '../../test/testDb.js';

vi.mock('../../db.js', async () => import('../../test/testDb.js'));

const USER_A = 'user-a';
const USER_B = 'user-b';

describe('Wishlist CRUD (shared)', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    resetTestDb();
    app = createTestApp();
  });

  it('creates a wishlist item with createdByName', async () => {
    const res = await supertest(app)
      .post('/api/wishlist')
      .set('X-User-Id', USER_A)
      .send({ title: 'Dark mode', description: 'Add dark mode', type: 'feature', createdByName: 'Mike' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();

    // Verify the name was stored
    const list = await supertest(app)
      .get('/api/wishlist')
      .set('X-User-Id', USER_A);
    expect(list.body[0].createdByName).toBe('Mike');
  });

  it('lists ALL users wishlist items (shared view)', async () => {
    await supertest(app)
      .post('/api/wishlist')
      .set('X-User-Id', USER_A)
      .send({ title: 'A item', createdByName: 'Mike' });
    await supertest(app)
      .post('/api/wishlist')
      .set('X-User-Id', USER_B)
      .send({ title: 'B item', createdByName: 'Molly' });

    // Both users see ALL items
    const aList = await supertest(app)
      .get('/api/wishlist')
      .set('X-User-Id', USER_A);
    expect(aList.body).toHaveLength(2);
    expect(aList.body.map((i: any) => i.title)).toContain('A item');
    expect(aList.body.map((i: any) => i.title)).toContain('B item');

    const bList = await supertest(app)
      .get('/api/wishlist')
      .set('X-User-Id', USER_B);
    expect(bList.body).toHaveLength(2);
  });

  it('owner can update their own wishlist item', async () => {
    const create = await supertest(app)
      .post('/api/wishlist')
      .set('X-User-Id', USER_A)
      .send({ title: 'Original' });
    const id = create.body.id;

    await supertest(app)
      .put(`/api/wishlist/${id}`)
      .set('X-User-Id', USER_A)
      .send({ title: 'Updated' });

    const list = await supertest(app)
      .get('/api/wishlist')
      .set('X-User-Id', USER_A);
    const item = list.body.find((i: any) => i.id === id);
    expect(item.title).toBe('Updated');
  });

  it('any user can toggle wishlist item status', async () => {
    const create = await supertest(app)
      .post('/api/wishlist')
      .set('X-User-Id', USER_A)
      .send({ title: 'Toggle me', createdByName: 'Mike' });
    const id = create.body.id;

    // User B toggles user A's item to done
    const toggle1 = await supertest(app)
      .put(`/api/wishlist/${id}/toggle`)
      .set('X-User-Id', USER_B);
    expect(toggle1.body.status).toBe('done');

    // User A toggles it back to open
    const toggle2 = await supertest(app)
      .put(`/api/wishlist/${id}/toggle`)
      .set('X-User-Id', USER_A);
    expect(toggle2.body.status).toBe('open');
  });

  it('owner can delete their own wishlist item', async () => {
    const create = await supertest(app)
      .post('/api/wishlist')
      .set('X-User-Id', USER_A)
      .send({ title: 'Delete me' });
    const id = create.body.id;

    await supertest(app)
      .delete(`/api/wishlist/${id}`)
      .set('X-User-Id', USER_A);

    const list = await supertest(app)
      .get('/api/wishlist')
      .set('X-User-Id', USER_A);
    expect(list.body).toHaveLength(0);
  });

  it('user B cannot update user A wishlist item', async () => {
    const create = await supertest(app)
      .post('/api/wishlist')
      .set('X-User-Id', USER_A)
      .send({ title: 'A only' });
    const id = create.body.id;

    const res = await supertest(app)
      .put(`/api/wishlist/${id}`)
      .set('X-User-Id', USER_B)
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('user B cannot delete user A wishlist item', async () => {
    const create = await supertest(app)
      .post('/api/wishlist')
      .set('X-User-Id', USER_A)
      .send({ title: 'Protected' });
    const id = create.body.id;

    await supertest(app)
      .delete(`/api/wishlist/${id}`)
      .set('X-User-Id', USER_B);

    // Should still exist
    const list = await supertest(app)
      .get('/api/wishlist')
      .set('X-User-Id', USER_A);
    expect(list.body).toHaveLength(1);
  });

  it('returns userId and createdByName in list response', async () => {
    await supertest(app)
      .post('/api/wishlist')
      .set('X-User-Id', USER_A)
      .send({ title: 'Test', createdByName: 'Mike' });

    const list = await supertest(app)
      .get('/api/wishlist')
      .set('X-User-Id', USER_B);
    expect(list.body[0].userId).toBe(USER_A);
    expect(list.body[0].createdByName).toBe('Mike');
  });
});
