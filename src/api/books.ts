import { apiFetch } from './client';
import type { Book } from '@/types';

export async function listBooks(): Promise<Book[]> {
  return apiFetch<Book[]>('/books');
}

export async function getBook(id: string): Promise<Book> {
  return apiFetch<Book>(`/books/${id}`);
}

export async function createBookApi(
  data: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>('/books', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return id;
}

export async function updateBookApi(
  id: string,
  data: Partial<Omit<Book, 'id' | 'createdAt'>>,
): Promise<void> {
  await apiFetch(`/books/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteBookApi(id: string): Promise<void> {
  await apiFetch(`/books/${id}`, { method: 'DELETE' });
}
