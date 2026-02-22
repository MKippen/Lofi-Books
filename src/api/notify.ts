// Simple pub/sub for reactive hooks — same pattern as the old Dexie database.ts
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Debounced server notification for backup triggering
let serverNotifyTimer: ReturnType<typeof setTimeout> | null = null;
const SERVER_NOTIFY_DEBOUNCE_MS = 5_000; // 5 seconds client-side debounce

function notifyServerOfMutation(): void {
  if (serverNotifyTimer) {
    clearTimeout(serverNotifyTimer);
  }
  serverNotifyTimer = setTimeout(() => {
    import('./backup').then(({ notifyMutation }) => {
      notifyMutation().catch((err) => {
        console.warn('Failed to notify server of mutation:', err);
      });
    });
  }, SERVER_NOTIFY_DEBOUNCE_MS);
}

export function notifyChange(): void {
  listeners.forEach((fn) => fn());
  notifyServerOfMutation();
}
