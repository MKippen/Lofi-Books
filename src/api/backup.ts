import { apiFetch } from './client';

export interface BackupStatusResponse {
  lastBackupTime: string | null;
  lastBackupError: string | null;
  backupInProgress: boolean;
  isConnected: boolean;
}

export interface RemoteMetadata {
  timestamp: string;
  version: number;
  bookCount: number;
  totalRecords: number;
}

export interface HasDataResponse {
  hasData: boolean;
  bookCount: number;
}

export async function getBackupStatus(): Promise<BackupStatusResponse> {
  return apiFetch<BackupStatusResponse>('/backup/status');
}

export async function registerBackupToken(accessToken: string): Promise<void> {
  await apiFetch('/backup/token', {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  });
}

export async function triggerBackup(accessToken: string): Promise<void> {
  await apiFetch('/backup/trigger', {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  });
}

export async function checkHasData(): Promise<HasDataResponse> {
  return apiFetch<HasDataResponse>('/backup/has-data');
}

export async function getRemoteMetadata(): Promise<RemoteMetadata | null> {
  return apiFetch<RemoteMetadata | null>('/backup/remote-meta');
}

export async function restoreFromBackup(accessToken: string): Promise<{ ok: boolean; bookCount: number; totalRecords: number }> {
  return apiFetch('/backup/restore', {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  });
}

export async function notifyMutation(): Promise<void> {
  await apiFetch('/backup/notify-mutation', { method: 'POST' });
}

// --- Dexie/IndexedDB migration ---

/** Check if the old MoBookDB (Dexie) database exists in this browser. */
export async function hasLegacyDexieData(): Promise<boolean> {
  const dbs = await indexedDB.databases();
  return dbs.some((db) => db.name === 'MoBookDB');
}

/** Read all data from the old MoBookDB IndexedDB and return it in the backup format. */
export async function readLegacyDexieData(): Promise<Record<string, unknown[]> | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open('MoBookDB');
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      const storeNames = Array.from(db.objectStoreNames);
      if (storeNames.length === 0) { db.close(); resolve(null); return; }

      const result: Record<string, unknown[]> = {};
      const tx = db.transaction(storeNames, 'readonly');

      // Map Dexie store names to backup format keys
      const storeMap: Record<string, string> = {
        books: 'books',
        characters: 'characters',
        chapters: 'chapters',
        ideas: 'ideas',
        timelineEvents: 'timelineEvents',
        storedImages: 'images',
        wishlistItems: 'wishlistItems',
      };

      let pending = storeNames.length;
      for (const storeName of storeNames) {
        const store = tx.objectStore(storeName);
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => {
          const key = storeMap[storeName] || storeName;
          result[key] = getAllReq.result || [];
          pending--;
          if (pending === 0) {
            db.close();
            // Ensure all expected keys exist
            for (const k of ['books', 'characters', 'chapters', 'ideas', 'timelineEvents', 'wishlistItems', 'images']) {
              if (!result[k]) result[k] = [];
            }
            if (!result.connections) result.connections = [];
            if (!result.chapterIllustrations) result.chapterIllustrations = [];
            resolve(result);
          }
        };
        getAllReq.onerror = () => {
          pending--;
          if (pending === 0) { db.close(); resolve(result); }
        };
      }
    };
  });
}

/** Import legacy Dexie data to the server for the current user. */
export async function importLocalData(data: Record<string, unknown[]>): Promise<{ ok: boolean; bookCount: number; totalRecords: number }> {
  return apiFetch('/backup/import-local', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Delete the old MoBookDB after successful migration. */
export async function deleteLegacyDexieDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('MoBookDB');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error('Failed to delete old database'));
  });
}
