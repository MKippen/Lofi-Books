import { apiFetch } from './client';
import type { TimelineEvent } from '@/types';

export async function listTimelineEvents(bookId: string): Promise<TimelineEvent[]> {
  return apiFetch<TimelineEvent[]>(`/books/${bookId}/timeline`);
}

export async function createTimelineEventApi(
  bookId: string,
  data: Omit<TimelineEvent, 'id' | 'bookId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>(`/books/${bookId}/timeline`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return id;
}

export async function updateTimelineEventApi(
  id: string,
  data: Partial<Omit<TimelineEvent, 'id' | 'createdAt'>>,
): Promise<void> {
  await apiFetch(`/timeline/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteTimelineEventApi(id: string): Promise<void> {
  await apiFetch(`/timeline/${id}`, { method: 'DELETE' });
}

export async function reorderTimelineEventsApi(bookId: string, orderedIds: string[]): Promise<void> {
  await apiFetch(`/books/${bookId}/timeline/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
}
