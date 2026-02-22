import { apiFetch } from './client';
import type { Character } from '@/types';

export async function listCharacters(bookId: string): Promise<Character[]> {
  return apiFetch<Character[]>(`/books/${bookId}/characters`);
}

export async function getCharacter(id: string): Promise<Character> {
  return apiFetch<Character>(`/characters/${id}`);
}

export async function createCharacterApi(
  bookId: string,
  data: Omit<Character, 'id' | 'bookId' | 'createdAt' | 'updatedAt' | 'sortOrder'>,
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>(`/books/${bookId}/characters`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return id;
}

export async function updateCharacterApi(
  id: string,
  data: Partial<Omit<Character, 'id' | 'createdAt'>>,
): Promise<void> {
  await apiFetch(`/characters/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteCharacterApi(id: string): Promise<void> {
  await apiFetch(`/characters/${id}`, { method: 'DELETE' });
}

export async function reorderCharactersApi(bookId: string, orderedIds: string[]): Promise<void> {
  await apiFetch(`/books/${bookId}/characters/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
}
