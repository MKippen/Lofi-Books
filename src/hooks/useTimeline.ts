import { useState, useEffect, useCallback } from 'react';
import { subscribe, notifyChange } from '@/api/notify';
import {
  listTimelineEvents, createTimelineEventApi,
  updateTimelineEventApi, deleteTimelineEventApi, reorderTimelineEventsApi,
} from '@/api/timeline';
import type { TimelineEvent } from '@/types';

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

export function useTimelineEvents(bookId: string | undefined) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!bookId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    const result = await listTimelineEvents(bookId);
    setEvents(result);
    setLoading(false);
  }, [bookId]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { events, loading, refresh };
}

// ---------------------------------------------------------------------------
// Mutation Functions
// ---------------------------------------------------------------------------

export async function createTimelineEvent(
  data: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const { bookId, ...rest } = data;
  const id = await createTimelineEventApi(bookId, rest);
  notifyChange();
  return id;
}

export async function updateTimelineEvent(
  id: string,
  data: Partial<Omit<TimelineEvent, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateTimelineEventApi(id, data);
  notifyChange();
}

export async function deleteTimelineEvent(id: string): Promise<void> {
  await deleteTimelineEventApi(id);
  notifyChange();
}

export async function reorderTimelineEvents(
  bookId: string,
  orderedIds: string[],
): Promise<void> {
  await reorderTimelineEventsApi(bookId, orderedIds);
  notifyChange();
}
