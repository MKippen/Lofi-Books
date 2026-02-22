import { useState, useEffect, useCallback } from 'react';
import { db, subscribe, notifyChange } from '@/db/database';
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
    const result = await db.characters
      .where('bookId')
      .equals(bookId)
      .sortBy('sortOrder');
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
    const result = await db.characters.get(id);
    setCharacter(result);
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
  const now = new Date();
  const id = crypto.randomUUID();

  // Determine the next sortOrder for this book
  const existing = await db.characters
    .where('bookId')
    .equals(data.bookId)
    .sortBy('sortOrder');
  const maxSortOrder = existing.length > 0
    ? Math.max(...existing.map((c) => c.sortOrder))
    : -1;

  await db.characters.add({
    ...data,
    id,
    sortOrder: maxSortOrder + 1,
    createdAt: now,
    updatedAt: now,
  });
  notifyChange();
  return id;
}

export async function updateCharacter(
  id: string,
  data: Partial<Omit<Character, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.characters.update(id, {
    ...data,
    updatedAt: new Date(),
  });
  notifyChange();
}

export async function deleteCharacter(id: string): Promise<void> {
  const character = await db.characters.get(id);
  if (character) {
    await db.transaction('rw', [db.characters, db.storedImages], async () => {
      // Delete any stored images associated with this character
      if (character.mainImageId) {
        await db.storedImages.delete(character.mainImageId);
      }
      await db.characters.delete(id);
    });
  }
  notifyChange();
}

export async function reorderCharacters(
  _bookId: string,
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.characters, async () => {
    const updates = orderedIds.map((charId, index) =>
      db.characters.update(charId, { sortOrder: index }),
    );
    await Promise.all(updates);
  });
  notifyChange();
}
