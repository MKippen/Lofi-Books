import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, apiUrl, getUserId } from '../client';

describe('API client', () => {
  beforeEach(() => {
    vi.mocked(globalThis.fetch).mockReset();
  });

  describe('getUserId', () => {
    it('returns the active MSAL account localAccountId', () => {
      expect(getUserId()).toBe('test-user-id');
    });
  });

  describe('apiUrl', () => {
    it('returns a full API URL', () => {
      const url = apiUrl('/books');
      expect(url).toContain('/api/books');
    });
  });

  describe('apiFetch', () => {
    it('sends JSON content-type and X-User-Id headers', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      } as Response);

      await apiFetch('/books');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toContain('/api/books');
      expect(options?.headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'X-User-Id': 'test-user-id',
      }));
    });

    it('parses JSON response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '123', title: 'Test' }),
      } as Response);

      const result = await apiFetch<{ id: string; title: string }>('/books/123');
      expect(result).toEqual({ id: '123', title: 'Test' });
    });

    it('throws on non-ok response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      } as Response);

      await expect(apiFetch('/books/missing')).rejects.toThrow('API error 404: Not Found');
    });

    it('forwards custom options (method, body)', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new' }),
      } as Response);

      await apiFetch('/books', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Book' }),
      });

      const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(options?.method).toBe('POST');
      expect(options?.body).toBe('{"title":"New Book"}');
    });
  });
});
