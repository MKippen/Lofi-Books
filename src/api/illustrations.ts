import { apiFetch } from './client';
import type { Illustration } from '@/types';

export async function listIllustrations(bookId: string, chapterId: string): Promise<Illustration[]> {
  return apiFetch<Illustration[]>(`/books/${bookId}/chapters/${chapterId}/illustrations`);
}

export async function createIllustrationApi(
  bookId: string,
  chapterId: string,
  data: { imageId: string; caption?: string },
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>(`/books/${bookId}/chapters/${chapterId}/illustrations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return id;
}

export async function updateIllustrationApi(
  id: string,
  data: Partial<{ caption: string; sortOrder: number }>,
): Promise<void> {
  await apiFetch(`/illustrations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteIllustrationApi(id: string): Promise<void> {
  await apiFetch(`/illustrations/${id}`, { method: 'DELETE' });
}
