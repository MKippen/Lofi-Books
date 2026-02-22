import { useState, useEffect, useCallback } from 'react';
import { db, subscribe, notifyChange } from '@/db/database';
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
    const result = await db.timelineEvents
      .where('bookId')
      .equals(bookId)
      .sortBy('sortOrder');
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
  const now = new Date();
  const id = crypto.randomUUID();
  await db.timelineEvents.add({
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  });
  notifyChange();
  return id;
}

export async function updateTimelineEvent(
  id: string,
  data: Partial<Omit<TimelineEvent, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.timelineEvents.update(id, {
    ...data,
    updatedAt: new Date(),
  });
  notifyChange();
}

export async function deleteTimelineEvent(id: string): Promise<void> {
  await db.timelineEvents.delete(id);
  notifyChange();
}

export async function reorderTimelineEvents(
  _bookId: string,
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.timelineEvents, async () => {
    const updates = orderedIds.map((eventId, index) =>
      db.timelineEvents.update(eventId, { sortOrder: index }),
    );
    await Promise.all(updates);
  });
  notifyChange();
}
