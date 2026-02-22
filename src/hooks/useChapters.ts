import { useState, useEffect, useCallback } from 'react';
import { subscribe, notifyChange } from '@/api/notify';
import {
  listChapters, getChapterApi,
  createChapterApi, updateChapterApi, deleteChapterApi, reorderChaptersApi,
} from '@/api/chapters';
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
    const result = await listChapters(bookId);
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
    try {
      const result = await getChapterApi(id);
      setChapter(result);
    } catch {
      setChapter(undefined);
    }
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
  const { bookId, ...rest } = data;
  const id = await createChapterApi(bookId, rest);
  notifyChange();
  return id;
}

export async function updateChapter(
  id: string,
  data: Partial<Omit<Chapter, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateChapterApi(id, data);
  notifyChange();
}

export async function deleteChapter(id: string): Promise<void> {
  await deleteChapterApi(id);
  notifyChange();
}

export async function reorderChapters(
  bookId: string,
  orderedIds: string[],
): Promise<void> {
  await reorderChaptersApi(bookId, orderedIds);
  notifyChange();
}
