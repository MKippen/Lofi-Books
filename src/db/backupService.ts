import { exportDB, importInto } from 'dexie-export-import';
import { db } from './database';
import {
  ensureBackupFolder,
  uploadBackup,
  uploadBackupMetadata,
  downloadBackup,
  getBackupMetadata,
  listBackups,
  deleteBackupFile,
} from '@/utils/graphClient';
import type { BackupMetadata } from '@/types';

const MAX_BACKUPS = 3;

/** Export the entire Dexie database to a Blob (handles Blobs natively). */
export async function exportDatabase(): Promise<Blob> {
  const blob = await exportDB(db, {
    prettyJson: false,
  });
  return blob;
}

/** Import a backup Blob into the Dexie database. Replaces all existing data. */
export async function importDatabase(blob: Blob): Promise<void> {
  await importInto(db, blob, {
    overwriteValues: true,
    clearTablesBeforeImport: true,
  });
}

/** Build metadata about the current database state. */
async function buildMetadata(userEmail: string): Promise<BackupMetadata> {
  const bookCount = await db.books.count();
  const counts = await Promise.all([
    db.books.count(),
    db.characters.count(),
    db.ideas.count(),
    db.timelineEvents.count(),
    db.chapters.count(),
    db.storedImages.count(),
    db.wishlistItems.count(),
  ]);
  const totalRecords = counts.reduce((a, b) => a + b, 0);

  return {
    timestamp: new Date().toISOString(),
    version: 1,
    bookCount,
    totalSize: totalRecords,
    userEmail,
  };
}

/**
 * Perform a full backup to OneDrive.
 * 1. Export Dexie DB to Blob
 * 2. Upload as latest-backup.json (always overwritten)
 * 3. Upload as backup-{timestamp}.json (for rotation)
 * 4. Upload metadata
 * 5. Rotate old backups (keep last MAX_BACKUPS)
 */
export async function performBackup(
  accessToken: string,
  userEmail: string,
): Promise<BackupMetadata> {
  await ensureBackupFolder(accessToken);

  const blob = await exportDatabase();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const timestampedName = `backup-${timestamp}.json`;

  await Promise.all([
    uploadBackup(accessToken, 'latest-backup.json', blob),
    uploadBackup(accessToken, timestampedName, blob),
  ]);

  const metadata = await buildMetadata(userEmail);
  await uploadBackupMetadata(accessToken, metadata);

  // Rotate old backups: keep only the latest MAX_BACKUPS
  try {
    const allBackups = await listBackups(accessToken);
    if (allBackups.length > MAX_BACKUPS) {
      const toDelete = allBackups.slice(MAX_BACKUPS);
      await Promise.all(
        toDelete.map((item) => deleteBackupFile(accessToken, item.id)),
      );
    }
  } catch (err) {
    console.warn('Backup rotation failed:', err);
  }

  return metadata;
}

/** Restore the database from the latest OneDrive backup. */
export async function restoreFromBackup(accessToken: string): Promise<void> {
  const blob = await downloadBackup(accessToken, 'latest-backup.json');
  await importDatabase(blob);
}

/** Get the metadata of the latest backup on OneDrive. Returns null if none exists. */
export async function getRemoteBackupInfo(
  accessToken: string,
): Promise<BackupMetadata | null> {
  return getBackupMetadata(accessToken);
}
