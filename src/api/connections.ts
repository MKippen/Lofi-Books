import { apiFetch } from './client';
import type { Connection } from '@/types';

export async function listConnections(bookId: string): Promise<Connection[]> {
  return apiFetch<Connection[]>(`/books/${bookId}/connections`);
}

export async function createConnectionApi(
  bookId: string,
  data: { fromIdeaId: string; toIdeaId: string; color: string },
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>(`/books/${bookId}/connections`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return id;
}

export async function updateConnectionApi(
  id: string,
  data: Partial<{ color: string }>,
): Promise<void> {
  await apiFetch(`/connections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteConnectionApi(id: string): Promise<void> {
  await apiFetch(`/connections/${id}`, { method: 'DELETE' });
}
