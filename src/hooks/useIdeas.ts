import { useState, useEffect, useCallback } from 'react';
import { subscribe, notifyChange } from '@/api/notify';
import {
  listIdeas, createIdeaApi, updateIdeaApi, deleteIdeaApi, bringToFrontApi,
} from '@/api/ideas';
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
    const result = await listIdeas(bookId);
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
  const { bookId, ...rest } = data;
  const id = await createIdeaApi(bookId, rest);
  notifyChange();
  return id;
}

export async function updateIdea(
  id: string,
  data: Partial<Omit<Idea, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateIdeaApi(id, data);
  notifyChange();
}

export async function deleteIdea(id: string): Promise<void> {
  await deleteIdeaApi(id);
  notifyChange();
}

export async function bringToFront(id: string, _bookId: string): Promise<void> {
  await bringToFrontApi(id);
  notifyChange();
}
