import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import {
  getBackupStatus,
  registerBackupToken,
  triggerBackup,
} from '@/api/backup';
import type { BackupState } from '@/types';

const TOKEN_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const STATUS_POLL_INTERVAL_MS = 60 * 1000; // 1 minute

export function useOneDriveBackup() {
  const { getAccessToken, isAuthenticated } = useAuth();

  const [state, setState] = useState<BackupState>({
    status: 'idle',
    lastBackupTime: null,
    lastBackupError: null,
    isOneDriveConnected: false,
  });

  const initializedRef = useRef(false);

  // Send the MSAL token to the server so it can do OneDrive backups
  const sendTokenToServer = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const token = await getAccessToken();
      await registerBackupToken(token);
      setState((prev) => ({ ...prev, isOneDriveConnected: true }));
    } catch (err) {
      console.error('Failed to send token to server:', err);
      setState((prev) => ({
        ...prev,
        isOneDriveConnected: false,
        lastBackupError: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [getAccessToken, isAuthenticated]);

  // Poll backup status from the server
  const pollStatus = useCallback(async () => {
    try {
      const status = await getBackupStatus();
      setState((prev) => ({
        ...prev,
        isOneDriveConnected: status.isConnected,
        lastBackupTime: status.lastBackupTime ? new Date(status.lastBackupTime) : prev.lastBackupTime,
        lastBackupError: status.lastBackupError,
        status: status.backupInProgress ? 'backing-up' : (status.lastBackupError ? 'error' : 'idle'),
      }));
    } catch {
      // Server might not be reachable — don't overwrite state
    }
  }, []);

  // Manual backup trigger
  const manualBackup = useCallback(async () => {
    if (!isAuthenticated) return;
    setState((prev) => ({ ...prev, status: 'backing-up' }));
    try {
      const token = await getAccessToken();
      await triggerBackup(token);
      setState((prev) => ({
        ...prev,
        status: 'success',
        lastBackupTime: new Date(),
        lastBackupError: null,
      }));
      setTimeout(() => {
        setState((prev) =>
          prev.status === 'success' ? { ...prev, status: 'idle' } : prev,
        );
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Backup failed';
      setState((prev) => ({
        ...prev,
        status: 'error',
        lastBackupError: message,
      }));
    }
  }, [getAccessToken, isAuthenticated]);

  // Initialization: send token + trigger first backup
  useEffect(() => {
    if (!isAuthenticated || initializedRef.current) return;
    initializedRef.current = true;

    const initialize = async () => {
      await sendTokenToServer();
      await pollStatus();
    };

    initialize();
  }, [isAuthenticated, sendTokenToServer, getAccessToken, pollStatus]);

  // Periodically refresh token on the server
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(sendTokenToServer, TOKEN_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, sendTokenToServer]);

  // Periodically poll backup status
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(pollStatus, STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, pollStatus]);

  return {
    ...state,
    manualBackup,
  };
}
