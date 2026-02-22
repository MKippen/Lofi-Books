import Dexie, { type EntityTable } from 'dexie';
import type { Book, Character, Idea, TimelineEvent, Chapter, StoredImage, WishlistItem } from '@/types';

const db = new Dexie('MoBookDB') as Dexie & {
  books: EntityTable<Book, 'id'>;
  characters: EntityTable<Character, 'id'>;
  ideas: EntityTable<Idea, 'id'>;
  timelineEvents: EntityTable<TimelineEvent, 'id'>;
  chapters: EntityTable<Chapter, 'id'>;
  storedImages: EntityTable<StoredImage, 'id'>;
  wishlistItems: EntityTable<WishlistItem, 'id'>;
};

db.version(1).stores({
  books: 'id, title, createdAt, updatedAt',
  characters: 'id, bookId, name, sortOrder',
  ideas: 'id, bookId, type',
  timelineEvents: 'id, bookId, chapterId, sortOrder',
  chapters: 'id, bookId, sortOrder, status',
  storedImages: 'id, bookId',
  wishlistItems: 'id, type, status, createdAt',
});

// Simple pub/sub for reactive hooks
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyChange(): void {
  listeners.forEach((fn) => fn());
}

export { db };
