import { useState, useEffect, useCallback } from 'react';
import { subscribe, notifyChange } from '@/api/notify';
import {
  listCharacters, getCharacter as getCharacterApi,
  createCharacterApi, updateCharacterApi, deleteCharacterApi, reorderCharactersApi,
} from '@/api/characters';
import type { Character } from '@/types';

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

export function useCharacters(bookId: string | undefined) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!bookId) {
      setCharacters([]);
      setLoading(false);
      return;
    }
    const result = await listCharacters(bookId);
    setCharacters(result);
    setLoading(false);
  }, [bookId]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { characters, loading, refresh };
}

export function useCharacter(id: string | undefined) {
  const [character, setCharacter] = useState<Character | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) {
      setCharacter(undefined);
      setLoading(false);
      return;
    }
    try {
      const result = await getCharacterApi(id);
      setCharacter(result);
    } catch {
      setCharacter(undefined);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { character, loading, refresh };
}

// ---------------------------------------------------------------------------
// Mutation Functions
// ---------------------------------------------------------------------------

export async function createCharacter(
  data: Omit<Character, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>,
): Promise<string> {
  const { bookId, ...rest } = data;
  const id = await createCharacterApi(bookId, rest);
  notifyChange();
  return id;
}

export async function updateCharacter(
  id: string,
  data: Partial<Omit<Character, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateCharacterApi(id, data);
  notifyChange();
}

export async function deleteCharacter(id: string): Promise<void> {
  await deleteCharacterApi(id);
  notifyChange();
}

export async function reorderCharacters(
  bookId: string,
  orderedIds: string[],
): Promise<void> {
  await reorderCharactersApi(bookId, orderedIds);
  notifyChange();
}
