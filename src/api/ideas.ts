import { apiFetch } from './client';
import type { Idea } from '@/types';

export async function listIdeas(bookId: string): Promise<Idea[]> {
  return apiFetch<Idea[]>(`/books/${bookId}/ideas`);
}

export async function createIdeaApi(
  bookId: string,
  data: Partial<Omit<Idea, 'id' | 'bookId' | 'createdAt' | 'updatedAt'>>,
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>(`/books/${bookId}/ideas`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return id;
}

export async function updateIdeaApi(
  id: string,
  data: Partial<Omit<Idea, 'id' | 'createdAt'>>,
): Promise<void> {
  await apiFetch(`/ideas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteIdeaApi(id: string): Promise<void> {
  await apiFetch(`/ideas/${id}`, { method: 'DELETE' });
}

export async function bringToFrontApi(id: string): Promise<void> {
  await apiFetch(`/ideas/${id}/bring-to-front`, { method: 'PUT' });
}
