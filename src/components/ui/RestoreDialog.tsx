import Modal from './Modal';
import Button from './Button';
import type { BackupFileSummary, RemoteMetadata } from '@/api/backup';
import { formatDistanceToNow } from 'date-fns';
import { CloudDownload, RotateCcw } from 'lucide-react';

interface RestoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void;
  metadata: RemoteMetadata | null;
  backups: BackupFileSummary[];
  selectedBackupName: string;
  onSelectBackup: (filename: string) => void;
  isRestoring: boolean;
}

export default function RestoreDialog({
  isOpen,
  onClose,
  onRestore,
  metadata,
  backups,
  selectedBackupName,
  onSelectBackup,
  isRestoring,
}: RestoreDialogProps) {
  if (!metadata && backups.length === 0) return null;

  const backupAge = metadata
    ? formatDistanceToNow(new Date(metadata.timestamp), { addSuffix: true })
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Restore from OneDrive?" size="sm">
      <div className="space-y-4">
        <p className="text-indigo/70 text-sm">
          Choose the restore point you want to use. Timestamped backups are safer than blindly restoring the moving latest backup.
        </p>

        {metadata ? (
          <div className="bg-cream rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-indigo/50">Latest backup age</span>
              <span className="text-indigo font-medium">{backupAge}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-indigo/50">Books in latest backup</span>
              <span className="text-indigo font-medium">{metadata.bookCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-indigo/50">Total records</span>
              <span className="text-indigo font-medium">{metadata.totalRecords}</span>
            </div>
          </div>
        ) : null}

        {backups.length > 0 ? (
          <div className="bg-cream rounded-xl p-4 space-y-3">
            <p className="text-xs text-indigo/50 font-semibold uppercase tracking-wide">Restore point</p>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {backups.map((backup) => {
                const age = formatDistanceToNow(new Date(backup.lastModified), { addSuffix: true });

                return (
                  <label
                    key={backup.name}
                    className="flex items-start gap-3 rounded-xl border border-primary/10 bg-white/70 px-3 py-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="restore-backup"
                      value={backup.name}
                      checked={selectedBackupName === backup.name}
                      onChange={() => onSelectBackup(backup.name)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm text-indigo font-medium">
                        <span className="truncate">{backup.name}</span>
                        {backup.isLatest ? (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                            Latest
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-indigo/50">
                        Saved {age}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <p className="text-indigo/40 text-xs">
          Restoring will replace all current data with the selected OneDrive backup.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isRestoring}>
            Start Fresh
          </Button>
          <Button variant="primary" size="sm" onClick={onRestore} disabled={isRestoring || !selectedBackupName}>
            {isRestoring ? (
              <>
                <RotateCcw size={14} className="animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <CloudDownload size={14} />
                Restore
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
