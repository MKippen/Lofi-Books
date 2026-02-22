import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useOneDriveBackup } from '@/hooks/useOneDriveBackup';
import { useAuth } from '@/hooks/useAuth';
import { checkHasData, getRemoteMetadata, restoreFromBackup, hasLegacyDexieData, readLegacyDexieData, importLocalData, deleteLegacyDexieDB } from '@/api/backup';
import { notifyChange } from '@/api/notify';
import type { BackupState } from '@/types';
import type { RemoteMetadata } from '@/api/backup';
import RestoreDialog from '@/components/ui/RestoreDialog';

interface BackupContextValue {
  state: BackupState;
  manualBackup: () => void;
  triggerRestore: () => void;
}

const BackupContext = createContext<BackupContextValue | null>(null);

export function useBackupContext() {
  const ctx = useContext(BackupContext);
  if (!ctx) throw new Error('useBackupContext must be used inside BackupProvider');
  return ctx;
}

interface BackupProviderProps {
  children: ReactNode;
}

export default function BackupProvider({ children }: BackupProviderProps) {
  const {
    status,
    lastBackupTime,
    lastBackupError,
    isOneDriveConnected,
    manualBackup,
  } = useOneDriveBackup();

  const { getAccessToken, isAuthenticated } = useAuth();

  // Restore dialog state
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [remoteMetadata, setRemoteMetadata] = useState<RemoteMetadata | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [checkedFirstLoad, setCheckedFirstLoad] = useState(false);

  // First-load restore check:
  // 1. If user has server data, skip
  // 2. If old Dexie/IndexedDB data exists in browser, auto-migrate it
  // 3. Otherwise, if OneDrive has a backup, prompt restore dialog
  useEffect(() => {
    if (!isAuthenticated || checkedFirstLoad) return;

    let cancelled = false;

    async function checkForRestore() {
      try {
        const { hasData } = await checkHasData();
        if (hasData) {
          // User already has data — clean up old Dexie DB if present
          try {
            if (await hasLegacyDexieData()) {
              await deleteLegacyDexieDB();
              console.log('Cleaned up old MoBookDB IndexedDB');
            }
          } catch { /* ignore */ }
          setCheckedFirstLoad(true);
          return;
        }

        // No server data — check for old Dexie data in this browser first
        try {
          if (await hasLegacyDexieData()) {
            const legacyData = await readLegacyDexieData();
            if (legacyData && Array.isArray(legacyData.books) && legacyData.books.length > 0) {
              console.log('Found legacy Dexie data, migrating to server...', {
                books: legacyData.books.length,
              });
              await importLocalData(legacyData);
              await deleteLegacyDexieDB();
              console.log('Legacy Dexie migration complete');
              if (!cancelled) notifyChange();
              setCheckedFirstLoad(true);
              return;
            }
          }
        } catch (err) {
          console.warn('Dexie migration check failed:', err);
        }

        // No Dexie data — check OneDrive
        if (!isOneDriveConnected) {
          setCheckedFirstLoad(true);
          return;
        }

        const meta = await getRemoteMetadata();
        if (cancelled) return;

        if (meta && meta.bookCount > 0) {
          setRemoteMetadata(meta);
          setShowRestoreDialog(true);
        }
      } catch (err) {
        console.warn('First-load restore check failed:', err);
      } finally {
        if (!cancelled) setCheckedFirstLoad(true);
      }
    }

    checkForRestore();
    return () => { cancelled = true; };
  }, [isAuthenticated, isOneDriveConnected, checkedFirstLoad]);

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    try {
      const token = await getAccessToken();
      await restoreFromBackup(token);
      setShowRestoreDialog(false);
      // Notify all hooks to re-fetch data
      notifyChange();
    } catch (err) {
      console.error('Restore failed:', err);
    } finally {
      setIsRestoring(false);
    }
  }, [getAccessToken]);

  const triggerRestore = useCallback(async () => {
    try {
      const meta = await getRemoteMetadata();
      if (meta) {
        setRemoteMetadata(meta);
        setShowRestoreDialog(true);
      }
    } catch (err) {
      console.warn('Failed to fetch remote metadata:', err);
    }
  }, []);

  const state: BackupState = {
    status,
    lastBackupTime,
    lastBackupError,
    isOneDriveConnected,
  };

  return (
    <BackupContext.Provider value={{ state, manualBackup, triggerRestore }}>
      {children}
      <RestoreDialog
        isOpen={showRestoreDialog}
        onClose={() => setShowRestoreDialog(false)}
        onRestore={handleRestore}
        metadata={remoteMetadata}
        isRestoring={isRestoring}
      />
    </BackupContext.Provider>
  );
}
