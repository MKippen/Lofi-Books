import { useState, useEffect, useCallback } from 'react';
import { db, subscribe, notifyChange } from '@/db/database';
import type { Idea } from '@/types';

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

export function useIdeas(bookId: string | undefined) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!bookId) {
      setIdeas([]);
      setLoading(false);
      return;
    }
    const result = await db.ideas
      .where('bookId')
      .equals(bookId)
      .toArray();
    setIdeas(result);
    setLoading(false);
  }, [bookId]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { ideas, loading, refresh };
}

// ---------------------------------------------------------------------------
// Mutation Functions
// ---------------------------------------------------------------------------

export async function createIdea(
  data: Omit<Idea, 'id' | 'createdAt' | 'updatedAt' | 'positionX' | 'positionY' | 'width' | 'height' | 'zIndex'> &
    Partial<Pick<Idea, 'positionX' | 'positionY' | 'width' | 'height' | 'zIndex'>>,
): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();

  // Determine the highest zIndex among ideas in this book
  const existing = await db.ideas
    .where('bookId')
    .equals(data.bookId)
    .toArray();
  const maxZ = existing.length > 0
    ? Math.max(...existing.map((i) => i.zIndex))
    : 0;

  await db.ideas.add({
    positionX: 100,
    positionY: 100,
    width: 220,
    height: 180,
    zIndex: maxZ + 1,
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  });
  notifyChange();
  return id;
}

export async function updateIdea(
  id: string,
  data: Partial<Omit<Idea, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.ideas.update(id, {
    ...data,
    updatedAt: new Date(),
  });
  notifyChange();
}

export async function deleteIdea(id: string): Promise<void> {
  await db.ideas.delete(id);
  notifyChange();
}

export async function bringToFront(id: string, bookId: string): Promise<void> {
  const existing = await db.ideas
    .where('bookId')
    .equals(bookId)
    .toArray();
  const maxZ = existing.length > 0
    ? Math.max(...existing.map((i) => i.zIndex))
    : 0;

  await db.ideas.update(id, {
    zIndex: maxZ + 1,
    updatedAt: new Date(),
  });
  notifyChange();
}
