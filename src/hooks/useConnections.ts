import { useState, useEffect, useCallback } from 'react';
import { subscribe, notifyChange } from '@/api/notify';
import {
  listConnections, createConnectionApi, updateConnectionApi, deleteConnectionApi,
} from '@/api/connections';
import type { Connection } from '@/types';

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

export function useConnections(bookId: string | undefined) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!bookId) {
      setConnections([]);
      setLoading(false);
      return;
    }
    const result = await listConnections(bookId);
    setConnections(result);
    setLoading(false);
  }, [bookId]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { connections, loading, refresh };
}

// ---------------------------------------------------------------------------
// Mutation Functions
// ---------------------------------------------------------------------------

export async function createConnection(
  bookId: string,
  fromIdeaId: string,
  toIdeaId: string,
  color: string,
): Promise<string> {
  const id = await createConnectionApi(bookId, { fromIdeaId, toIdeaId, color });
  notifyChange();
  return id;
}

export async function updateConnection(
  id: string,
  data: Partial<{ color: string }>,
): Promise<void> {
  await updateConnectionApi(id, data);
  notifyChange();
}

export async function deleteConnection(id: string): Promise<void> {
  await deleteConnectionApi(id);
  notifyChange();
}
