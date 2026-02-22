import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { subscribe, db } from '@/db/database';
import {
  performBackup,
  restoreFromBackup,
  getRemoteBackupInfo,
} from '@/db/backupService';
import { validateOneDriveAccess, ensureBackupFolder } from '@/utils/graphClient';
import type { BackupState, BackupMetadata } from '@/types';

const BACKUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_BACKUP_MS = 30 * 1000;     // 30-second debounce for action-triggered backups

export function useOneDriveBackup() {
  const { getAccessToken, email, isAuthenticated } = useAuth();

  const [state, setState] = useState<BackupState>({
    status: 'idle',
    lastBackupTime: null,
    lastBackupError: null,
    isOneDriveConnected: false,
  });

  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [remoteMetadata, setRemoteMetadata] = useState<BackupMetadata | null>(null);

  const backupInProgressRef = useRef(false);
  const debouncedBackupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef(false);

  // Core backup function
  const doBackup = useCallback(async () => {
    if (backupInProgressRef.current || !isAuthenticated) return;

    backupInProgressRef.current = true;
    setState((prev) => ({ ...prev, status: 'backing-up' }));

    try {
      const token = await getAccessToken();
      const metadata = await performBackup(token, email);
      setState((prev) => ({
        ...prev,
        status: 'success',
        lastBackupTime: new Date(metadata.timestamp),
        lastBackupError: null,
      }));

      setTimeout(() => {
        setState((prev) =>
          prev.status === 'success' ? { ...prev, status: 'idle' } : prev,
        );
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Backup failed';
      console.error('Backup failed:', err);
      setState((prev) => ({
        ...prev,
        status: 'error',
        lastBackupError: message,
      }));
    } finally {
      backupInProgressRef.current = false;
    }
  }, [getAccessToken, email, isAuthenticated]);

  // Debounced backup (for action-triggered)
  const triggerBackup = useCallback(() => {
    if (debouncedBackupTimerRef.current) {
      clearTimeout(debouncedBackupTimerRef.current);
    }
    debouncedBackupTimerRef.current = setTimeout(() => {
      doBackup();
    }, DEBOUNCE_BACKUP_MS);
  }, [doBackup]);

  // Restore function
  const doRestore = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'restoring' }));
    try {
      const token = await getAccessToken();
      await restoreFromBackup(token);
      setState((prev) => ({
        ...prev,
        status: 'idle',
        lastBackupError: null,
      }));
      setShowRestoreDialog(false);
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Restore failed';
      setState((prev) => ({
        ...prev,
        status: 'error',
        lastBackupError: message,
      }));
    }
  }, [getAccessToken]);

  // Manual backup
  const manualBackup = useCallback(() => doBackup(), [doBackup]);

  // Initialization: validate OneDrive + check for restore
  useEffect(() => {
    if (!isAuthenticated || initializedRef.current) return;
    initializedRef.current = true;

    const initialize = async () => {
      try {
        const token = await getAccessToken();

        const hasAccess = await validateOneDriveAccess(token);
        if (!hasAccess) {
          setState((prev) => ({
            ...prev,
            isOneDriveConnected: false,
            status: 'error',
            lastBackupError: 'OneDrive access denied. Please check your permissions.',
          }));
          return;
        }

        await ensureBackupFolder(token);
        setState((prev) => ({ ...prev, isOneDriveConnected: true }));

        const remoteMeta = await getRemoteBackupInfo(token);
        const localBookCount = await db.books.count();
        const localHasData = localBookCount > 0;

        if (remoteMeta && !localHasData) {
          // OneDrive has data, local is empty (new device) -> offer restore
          setRemoteMetadata(remoteMeta);
          setShowRestoreDialog(true);
        } else if (localHasData) {
          // Local has data -> just back up silently
          setState((prev) => ({ ...prev, status: 'backing-up' }));
          await performBackup(token, email);
          setState((prev) => ({
            ...prev,
            lastBackupTime: new Date(),
            status: 'idle',
          }));
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('Backup initialization failed:', errMsg, err);
        setState((prev) => ({
          ...prev,
          status: 'error',
          lastBackupError: errMsg,
          isOneDriveConnected: false,
        }));
      }
    };

    initialize();
  }, [isAuthenticated, getAccessToken, email]);

  // Periodic backup (every 5 minutes)
  useEffect(() => {
    if (!isAuthenticated || !state.isOneDriveConnected) return;

    intervalRef.current = setInterval(doBackup, BACKUP_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated, state.isOneDriveConnected, doBackup]);

  // Backup on data changes (debounced)
  useEffect(() => {
    if (!isAuthenticated || !state.isOneDriveConnected) return;

    const unsubscribe = subscribe(() => {
      triggerBackup();
    });

    return () => {
      unsubscribe();
      if (debouncedBackupTimerRef.current) {
        clearTimeout(debouncedBackupTimerRef.current);
      }
    };
  }, [isAuthenticated, state.isOneDriveConnected, triggerBackup]);

  // Backup on window blur and beforeunload
  useEffect(() => {
    if (!isAuthenticated || !state.isOneDriveConnected) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        doBackup();
      }
    };

    const handleBeforeUnload = () => {
      doBackup();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated, state.isOneDriveConnected, doBackup]);

  return {
    ...state,
    showRestoreDialog,
    remoteMetadata,
    doRestore,
    dismissRestoreDialog: () => setShowRestoreDialog(false),
    manualBackup,
  };
}
