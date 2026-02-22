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
