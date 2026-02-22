import { apiFetch } from './client';
import type { WishlistItem } from '@/types';

export async function listWishlistItems(): Promise<WishlistItem[]> {
  return apiFetch<WishlistItem[]>('/wishlist');
}

export async function createWishlistItemApi(
  data: Pick<WishlistItem, 'title' | 'description' | 'type' | 'createdByName'>,
): Promise<string> {
  const { id } = await apiFetch<{ id: string }>('/wishlist', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return id;
}

export async function updateWishlistItemApi(
  id: string,
  data: Partial<Omit<WishlistItem, 'id' | 'createdAt'>>,
): Promise<void> {
  await apiFetch(`/wishlist/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function toggleWishlistItemStatusApi(id: string): Promise<void> {
  await apiFetch(`/wishlist/${id}/toggle`, { method: 'PUT' });
}

export async function deleteWishlistItemApi(id: string): Promise<void> {
  await apiFetch(`/wishlist/${id}`, { method: 'DELETE' });
}
