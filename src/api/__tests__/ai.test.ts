import { beforeEach, describe, expect, it, vi } from 'vitest';
import { proofreadText, streamChat } from '../ai';

describe('ai API', () => {
  beforeEach(() => {
    vi.mocked(globalThis.fetch).mockReset();
  });

  it('proofread sends auth headers', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ issues: [], summary: 'ok' }),
    } as Response);

    await proofreadText('Some text', 'Chapter 1');

    const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toContain('/api/ai/proofread');
    expect(options?.headers).toEqual(expect.objectContaining({
      'Content-Type': 'application/json',
      'X-User-Id': 'test-oid',
      'X-Legacy-User-Ids': 'test-local-account-id,test-home-account-id',
      Authorization: 'Bearer mock-id-token',
    }));
  });

  it('chat stream sends auth headers', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Missing authorization header'),
    } as Response);

    const gen = streamChat([{ role: 'user', content: 'Hi' }]);
    await expect(gen.next()).rejects.toThrow('AI error 401: Missing authorization header');

    const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toContain('/api/ai/chat');
    expect(options?.headers).toEqual(expect.objectContaining({
      'Content-Type': 'application/json',
      'X-User-Id': 'test-oid',
      'X-Legacy-User-Ids': 'test-local-account-id,test-home-account-id',
      Authorization: 'Bearer mock-id-token',
    }));
  });
});
