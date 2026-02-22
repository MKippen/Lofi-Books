/**
 * Microsoft Graph API helper for OneDrive operations.
 * All operations target the user's personal OneDrive.
 *
 * OneDrive folder structure:
 *   /Lofi Books/
 *     latest-backup.json       <- always the most recent
 *     backup-{timestamp}.json  <- rotated, keep last 3
 *     backup-meta.json         <- metadata about latest backup
 */

import type { BackupMetadata } from '@/types';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const BACKUP_FOLDER = 'Lofi Books';

interface DriveItem {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  file?: { mimeType: string };
  folder?: { childCount: number };
}

async function graphFetch(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${GRAPH_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Graph API error ${response.status}: ${errorText}`);
  }

  return response;
}

/** Ensure the "Lofi Books" folder exists in OneDrive root */
export async function ensureBackupFolder(accessToken: string): Promise<void> {
  try {
    await graphFetch(accessToken, `/me/drive/root:/${BACKUP_FOLDER}`);
  } catch {
    await graphFetch(accessToken, '/me/drive/root/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: BACKUP_FOLDER,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      }),
    });
  }
}

/** Validate OneDrive access (used at login to gate the app) */
export async function validateOneDriveAccess(accessToken: string): Promise<boolean> {
  try {
    await graphFetch(accessToken, '/me/drive');
    return true;
  } catch (err) {
    console.error('OneDrive validation failed:', err);
    throw err; // Let the caller see the actual error
  }
}

/**
 * Upload a backup file to OneDrive.
 * For files < 4MB, use simple upload. For larger, use upload session.
 */
export async function uploadBackup(
  accessToken: string,
  filename: string,
  data: Blob,
): Promise<void> {
  const path = `/me/drive/root:/${BACKUP_FOLDER}/${filename}:/content`;

  if (data.size < 4 * 1024 * 1024) {
    await graphFetch(accessToken, path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: data,
    });
  } else {
    // Upload session for larger files
    const sessionResponse = await graphFetch(
      accessToken,
      `/me/drive/root:/${BACKUP_FOLDER}/${filename}:/createUploadSession`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: {
            '@microsoft.graph.conflictBehavior': 'replace',
          },
        }),
      },
    );
    const { uploadUrl } = await sessionResponse.json();

    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalSize = data.size;
    let offset = 0;

    while (offset < totalSize) {
      const end = Math.min(offset + CHUNK_SIZE, totalSize);
      const chunk = data.slice(offset, end);

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': `${chunk.size}`,
          'Content-Range': `bytes ${offset}-${end - 1}/${totalSize}`,
        },
        body: chunk,
      });

      offset = end;
    }
  }
}

/** Download a backup file from OneDrive */
export async function downloadBackup(
  accessToken: string,
  filename: string,
): Promise<Blob> {
  const response = await graphFetch(
    accessToken,
    `/me/drive/root:/${BACKUP_FOLDER}/${filename}:/content`,
  );
  return response.blob();
}

/** Get backup metadata (stored as a separate small JSON file) */
export async function getBackupMetadata(
  accessToken: string,
): Promise<BackupMetadata | null> {
  try {
    const response = await graphFetch(
      accessToken,
      `/me/drive/root:/${BACKUP_FOLDER}/backup-meta.json:/content`,
    );
    return response.json();
  } catch {
    return null;
  }
}

/** Upload backup metadata */
export async function uploadBackupMetadata(
  accessToken: string,
  metadata: BackupMetadata,
): Promise<void> {
  const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
  await uploadBackup(accessToken, 'backup-meta.json', blob);
}

/** List all backup files in the folder (for rotation) */
export async function listBackups(
  accessToken: string,
): Promise<DriveItem[]> {
  const response = await graphFetch(
    accessToken,
    `/me/drive/root:/${BACKUP_FOLDER}:/children?$orderby=lastModifiedDateTime desc`,
  );
  const data = await response.json();
  return (data.value as DriveItem[]).filter(
    (item: DriveItem) => item.name.startsWith('backup-') && item.name !== 'backup-meta.json',
  );
}

/** Delete a file from OneDrive (for backup rotation) */
export async function deleteBackupFile(
  accessToken: string,
  itemId: string,
): Promise<void> {
  await fetch(`${GRAPH_BASE}/me/drive/items/${itemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
