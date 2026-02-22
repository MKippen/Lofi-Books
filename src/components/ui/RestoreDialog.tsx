import Modal from './Modal';
import Button from './Button';
import type { BackupMetadata } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface RestoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: () => void;
  metadata: BackupMetadata | null;
}

export default function RestoreDialog({
  isOpen,
  onClose,
  onRestore,
  metadata,
}: RestoreDialogProps) {
  if (!metadata) return null;

  const backupAge = formatDistanceToNow(new Date(metadata.timestamp), {
    addSuffix: true,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Restore from OneDrive?" size="sm">
      <div className="space-y-4">
        <p className="text-indigo/70 text-sm">
          A backup from your OneDrive was found. Would you like to restore it?
        </p>

        <div className="bg-cream rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-indigo/50">Last backed up</span>
            <span className="text-indigo font-medium">{backupAge}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-indigo/50">Books</span>
            <span className="text-indigo font-medium">{metadata.bookCount}</span>
          </div>
        </div>

        <p className="text-indigo/40 text-xs">
          Restoring will replace all local data with the OneDrive backup.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Keep Local Data
          </Button>
          <Button variant="primary" size="sm" onClick={onRestore}>
            Restore from OneDrive
          </Button>
        </div>
      </div>
    </Modal>
  );
}
