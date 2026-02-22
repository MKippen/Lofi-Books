import { useState, useEffect, useCallback } from 'react';
import { db, subscribe, notifyChange } from '@/db/database';
import type { Book } from '@/types';

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await db.books.orderBy('createdAt').reverse().toArray();
    setBooks(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { books, loading, refresh };
}

export function useBook(id: string | undefined) {
  const [book, setBook] = useState<Book | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) {
      setBook(undefined);
      setLoading(false);
      return;
    }
    const result = await db.books.get(id);
    setBook(result);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  return { book, loading, refresh };
}

// ---------------------------------------------------------------------------
// Mutation Functions
// ---------------------------------------------------------------------------

export async function createBook(
  data: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.books.add({
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  });
  notifyChange();
  return id;
}

export async function updateBook(
  id: string,
  data: Partial<Omit<Book, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.books.update(id, {
    ...data,
    updatedAt: new Date(),
  });
  notifyChange();
}

export async function deleteBook(id: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.books, db.characters, db.ideas, db.timelineEvents, db.chapters, db.storedImages],
    async () => {
      // Delete all related data for this book
      await db.characters.where('bookId').equals(id).delete();
      await db.ideas.where('bookId').equals(id).delete();
      await db.timelineEvents.where('bookId').equals(id).delete();
      await db.chapters.where('bookId').equals(id).delete();
      await db.storedImages.where('bookId').equals(id).delete();
      await db.books.delete(id);
    },
  );
  notifyChange();
}
