import { useState, useEffect, useCallback } from 'react';
import { db, subscribe, notifyChange } from '@/db/database';
import type { WishlistItem, WishlistItemStatus } from '@/types';

// ---------------------------------------------------------------------------
// Query Hook
// ---------------------------------------------------------------------------

export function useWishlist() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await db.wishlistItems
      .orderBy('createdAt')
      .reverse()
      .toArray();
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
  data: Pick<WishlistItem, 'title' | 'description' | 'type'>,
): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();

  await db.wishlistItems.add({
    ...data,
    id,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  });
  notifyChange();
  return id;
}

export async function updateWishlistItem(
  id: string,
  data: Partial<Omit<WishlistItem, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.wishlistItems.update(id, {
    ...data,
    updatedAt: new Date(),
  });
  notifyChange();
}

export async function toggleWishlistItemStatus(id: string): Promise<void> {
  const item = await db.wishlistItems.get(id);
  if (!item) return;

  const newStatus: WishlistItemStatus = item.status === 'open' ? 'done' : 'open';
  await db.wishlistItems.update(id, {
    status: newStatus,
    updatedAt: new Date(),
  });
  notifyChange();
}

export async function deleteWishlistItem(id: string): Promise<void> {
  await db.wishlistItems.delete(id);
  notifyChange();
}
