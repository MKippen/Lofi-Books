import { apiFetch } from './client';
import type { Chapter } from '@/types';

export async function listChapters(bookId: string): Promise<Chapter[]> {
  return apiFetch<Chapter[]>(`/books/${bookId}/chapters`);
}

export async function getChapterApi(id: string): Promise<Chapter> {
  return apiFetch<Chapter>(`/chapters/${id}`);
}

export async function createChapterApi(
  bookId: string,
  data: Partial<Pick<Chapter, 'title' | 'content' | 'wordCount' | 'status' | 'notes'>>,
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>(`/books/${bookId}/chapters`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return id;
}

export async function updateChapterApi(
  id: string,
  data: Partial<Omit<Chapter, 'id' | 'createdAt'>>,
): Promise<void> {
  await apiFetch(`/chapters/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteChapterApi(id: string): Promise<void> {
  await apiFetch(`/chapters/${id}`, { method: 'DELETE' });
}

export async function reorderChaptersApi(bookId: string, orderedIds: string[]): Promise<void> {
  await apiFetch(`/books/${bookId}/chapters/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
}
