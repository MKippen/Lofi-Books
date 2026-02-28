import { describe, it, expect, vi, beforeEach } from 'vitest';
import { imageUrl, uploadImage, deleteImageApi } from '../images';

describe('images API', () => {
  beforeEach(() => {
    vi.mocked(globalThis.fetch).mockReset();
  });

  describe('imageUrl', () => {
    it('returns null for null/undefined imageId', () => {
      expect(imageUrl(null)).toBeNull();
      expect(imageUrl(undefined)).toBeNull();
    });

    it('returns a valid URL for a given imageId', () => {
      const url = imageUrl('img-123');
      expect(url).toContain('/api/images/img-123');
    });
  });

  describe('uploadImage', () => {
    it('uploads a file and returns the image ID', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'uploaded-img-id' }),
      } as Response);

      const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
      const id = await uploadImage('book-1', file);
      expect(id).toBe('uploaded-img-id');

      const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toContain('/api/images/upload/book-1');
      expect(options?.method).toBe('POST');
      expect(options?.body).toBeInstanceOf(FormData);
    });

    it('throws on upload failure', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 413,
        text: () => Promise.resolve('File too large'),
      } as Response);

      const file = new File(['data'], 'big.jpg', { type: 'image/jpeg' });
      await expect(uploadImage('book-1', file)).rejects.toThrow('Upload failed 413');
    });
  });

  describe('deleteImageApi', () => {
    it('sends a DELETE request', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      } as Response);

      await deleteImageApi('img-123');

      const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(url).toContain('/api/images/img-123');
      expect(options?.method).toBe('DELETE');
    });

    it('throws when server returns an error', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      } as Response);

      await expect(deleteImageApi('img-123')).rejects.toThrow();
    });
  });
});
