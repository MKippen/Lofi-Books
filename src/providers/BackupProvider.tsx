import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useOneDriveBackup } from '@/hooks/useOneDriveBackup';
import { useAuth } from '@/hooks/useAuth';
import { checkHasData, getRemoteMetadata, restoreFromBackup } from '@/api/backup';
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

  // First-load restore check: if DB is empty and OneDrive has a backup, prompt
  useEffect(() => {
    if (!isAuthenticated || !isOneDriveConnected || checkedFirstLoad) return;

    let cancelled = false;

    async function checkForRestore() {
      try {
        const { hasData } = await checkHasData();
        if (hasData) {
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
