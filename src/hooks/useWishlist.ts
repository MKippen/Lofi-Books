import { useState, useEffect, useCallback } from 'react';
import { subscribe, notifyChange } from '@/api/notify';
import {
  listWishlistItems, createWishlistItemApi,
  updateWishlistItemApi, toggleWishlistItemStatusApi, deleteWishlistItemApi,
} from '@/api/wishlist';
import type { WishlistItem } from '@/types';

// ---------------------------------------------------------------------------
// Query Hook
// ---------------------------------------------------------------------------

export function useWishlist() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await listWishlistItems();
    setItems(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { items, loading, refresh };
}

// ---------------------------------------------------------------------------
// Mutation Functions
// ---------------------------------------------------------------------------

export async function createWishlistItem(
  data: Pick<WishlistItem, 'title' | 'description' | 'type' | 'createdByName'>,
): Promise<string> {
  const id = await createWishlistItemApi(data);
  notifyChange();
  return id;
}

export async function updateWishlistItem(
  id: string,
  data: Partial<Omit<WishlistItem, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateWishlistItemApi(id, data);
  notifyChange();
}

export async function toggleWishlistItemStatus(id: string): Promise<void> {
  await toggleWishlistItemStatusApi(id);
  notifyChange();
}

export async function deleteWishlistItem(id: string): Promise<void> {
  await deleteWishlistItemApi(id);
  notifyChange();
}
