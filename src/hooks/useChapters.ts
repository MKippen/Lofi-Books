import { useState, useEffect, useCallback } from 'react';
import { db, subscribe, notifyChange } from '@/db/database';
import type { Chapter } from '@/types';

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

export function useChapters(bookId: string | undefined) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!bookId) {
      setChapters([]);
      setLoading(false);
      return;
    }
    const result = await db.chapters
      .where('bookId')
      .equals(bookId)
      .sortBy('sortOrder');
    setChapters(result);
    setLoading(false);
  }, [bookId]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { chapters, loading, refresh };
}

export function useChapter(id: string | undefined) {
  const [chapter, setChapter] = useState<Chapter | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) {
      setChapter(undefined);
      setLoading(false);
      return;
    }
    const result = await db.chapters.get(id);
    setChapter(result);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { chapter, loading, refresh };
}

// ---------------------------------------------------------------------------
// Mutation Functions
// ---------------------------------------------------------------------------

export async function createChapter(
  data: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt' | 'content' | 'wordCount' | 'status' | 'sortOrder'> &
    Partial<Pick<Chapter, 'content' | 'wordCount' | 'status' | 'sortOrder'>>,
): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();

  // Determine the next sortOrder for this book
  const existing = await db.chapters
    .where('bookId')
    .equals(data.bookId)
    .sortBy('sortOrder');
  const maxSortOrder = existing.length > 0
    ? Math.max(...existing.map((c) => c.sortOrder))
    : -1;

  await db.chapters.add({
    content: '',
    wordCount: 0,
    status: 'draft',
    sortOrder: maxSortOrder + 1,
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  });
  notifyChange();
  return id;
}

export async function updateChapter(
  id: string,
  data: Partial<Omit<Chapter, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.chapters.update(id, {
    ...data,
    updatedAt: new Date(),
  });
  notifyChange();
}

export async function deleteChapter(id: string): Promise<void> {
  await db.chapters.delete(id);
  notifyChange();
}

export async function reorderChapters(
  _bookId: string,
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.chapters, async () => {
    const updates = orderedIds.map((chapterId, index) =>
      db.chapters.update(chapterId, { sortOrder: index }),
    );
    await Promise.all(updates);
  });
  notifyChange();
}
