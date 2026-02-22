import { useState, useEffect, useCallback } from 'react';
import { subscribe, notifyChange } from '@/api/notify';
import {
  listIllustrations, createIllustrationApi,
  updateIllustrationApi, deleteIllustrationApi,
} from '@/api/illustrations';
import type { Illustration } from '@/types';

// ---------------------------------------------------------------------------
// Query Hook
// ---------------------------------------------------------------------------

export function useIllustrations(bookId: string | undefined, chapterId: string | undefined) {
  const [illustrations, setIllustrations] = useState<Illustration[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!bookId || !chapterId) {
      setIllustrations([]);
      setLoading(false);
      return;
    }
    const result = await listIllustrations(bookId, chapterId);
    setIllustrations(result);
    setLoading(false);
  }, [bookId, chapterId]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { illustrations, loading, refresh };
}

// ---------------------------------------------------------------------------
// Mutation Functions
// ---------------------------------------------------------------------------

export async function createIllustration(
  bookId: string,
  chapterId: string,
  imageId: string,
  caption: string = '',
): Promise<string> {
  const id = await createIllustrationApi(bookId, chapterId, { imageId, caption });
  notifyChange();
  return id;
}

export async function updateIllustration(
  id: string,
  data: Partial<{ caption: string; sortOrder: number }>,
): Promise<void> {
  await updateIllustrationApi(id, data);
  notifyChange();
}

export async function deleteIllustration(id: string): Promise<void> {
  await deleteIllustrationApi(id);
  notifyChange();
}
