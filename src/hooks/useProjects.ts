import { useState, useEffect, useCallback } from 'react';
import { subscribe, notifyChange } from '@/api/notify';
import { claimOrphanedBooks, listBooks, getBook, createBookApi, updateBookApi, deleteBookApi } from '@/api/books';
import type { Book } from '@/types';

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await listBooks();
    setBooks(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Claim any orphaned books from before user-isolation was added, then load
    claimOrphanedBooks().catch(() => {}).then(refresh);
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
    try {
      const result = await getBook(id);
      setBook(result);
    } catch {
      setBook(undefined);
    }
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
  const id = await createBookApi(data);
  notifyChange();
  return id;
}

export async function updateBook(
  id: string,
  data: Partial<Omit<Book, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateBookApi(id, data);
  notifyChange();
}

export async function deleteBook(id: string): Promise<void> {
  await deleteBookApi(id);
  notifyChange();
}
