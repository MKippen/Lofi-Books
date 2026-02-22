import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Cloud, CloudUpload, CloudDownload, RotateCcw, Info } from 'lucide-react';
import { useBackupContext } from '@/providers/BackupProvider';
import { useAuth } from '@/hooks/useAuth';
import { getRemoteMetadata } from '@/api/backup';
import type { RemoteMetadata } from '@/api/backup';
import { formatDistanceToNow } from 'date-fns';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { state, manualBackup, triggerRestore } = useBackupContext();
  const { displayName, email } = useAuth();

  const [remoteMeta, setRemoteMeta] = useState<RemoteMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  useEffect(() => {
    getRemoteMetadata()
      .then(setRemoteMeta)
      .catch(() => setRemoteMeta(null))
      .finally(() => setLoadingMeta(false));
  }, [state.lastBackupTime]);

  const handleRestoreConfirm = () => {
    setShowRestoreConfirm(false);
    triggerRestore();
  };

  return (
    <div className="min-h-screen bookshop-bg">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-2 rounded-xl text-indigo/40 hover:text-indigo/70 hover:bg-indigo/5 transition-colors cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-heading text-2xl text-indigo">Settings</h1>
        </div>

        {/* Account Section */}
        <section className="bg-surface rounded-2xl border border-primary/10 shadow-sm p-6 mb-6">
          <h2 className="font-heading text-lg text-indigo mb-4">Account</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-indigo/50">Signed in as</span>
              <span className="text-indigo font-medium">{displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-indigo/50">Email</span>
              <span className="text-indigo/70">{email}</span>
            </div>
          </div>
        </section>

        {/* OneDrive Backup Section */}
        <section className="bg-surface rounded-2xl border border-primary/10 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Cloud size={18} className={state.isOneDriveConnected ? 'text-green-500' : 'text-red-400'} />
            <h2 className="font-heading text-lg text-indigo">OneDrive Backup</h2>
          </div>

          {/* Connection Status */}
          <div className="space-y-3 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-indigo/50">Status</span>
              <span className={`font-medium ${state.isOneDriveConnected ? 'text-green-600' : 'text-red-500'}`}>
                {state.isOneDriveConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-indigo/50">Last backup</span>
              <span className="text-indigo font-medium">
                {state.lastBackupTime
                  ? formatDistanceToNow(state.lastBackupTime, { addSuffix: true })
                  : 'Never'}
              </span>
            </div>
            {state.lastBackupError && (
              <div className="flex justify-between">
                <span className="text-indigo/50">Last error</span>
                <span className="text-red-500 text-xs max-w-[60%] text-right">{state.lastBackupError}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-indigo/50">Auto-save</span>
              <span className="text-indigo/70">Active (saves after changes)</span>
            </div>
          </div>

          {/* Remote Backup Info */}
          {loadingMeta ? (
            <div className="bg-cream rounded-xl p-4 mb-6">
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-indigo/10 rounded w-2/3" />
                <div className="h-3 bg-indigo/10 rounded w-1/2" />
              </div>
            </div>
          ) : remoteMeta ? (
            <div className="bg-cream rounded-xl p-4 mb-6 space-y-2">
              <p className="text-xs text-indigo/50 font-semibold uppercase tracking-wide mb-2">OneDrive Backup</p>
              <div className="flex justify-between text-xs">
                <span className="text-indigo/50">Backed up</span>
                <span className="text-indigo font-medium">
                  {formatDistanceToNow(new Date(remoteMeta.timestamp), { addSuffix: true })}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-indigo/50">Books</span>
                <span className="text-indigo font-medium">{remoteMeta.bookCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-indigo/50">Total records</span>
                <span className="text-indigo font-medium">{remoteMeta.totalRecords}</span>
              </div>
            </div>
          ) : (
            <div className="bg-cream rounded-xl p-4 mb-6">
              <p className="text-xs text-indigo/40">No backup found on OneDrive.</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={manualBackup}
              disabled={state.status === 'backing-up' || !state.isOneDriveConnected}
            >
              {state.status === 'backing-up' ? (
                <>
                  <RotateCcw size={14} className="animate-spin" />
                  Backing up...
                </>
              ) : (
                <>
                  <CloudUpload size={14} />
                  Backup Now
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowRestoreConfirm(true)}
              disabled={!remoteMeta || !state.isOneDriveConnected}
            >
              <CloudDownload size={14} />
              Restore from OneDrive
            </Button>
          </div>
        </section>

        {/* Info Note */}
        <div className="flex items-start gap-3 bg-accent/5 rounded-xl border border-accent/10 p-4 text-xs text-indigo/50">
          <Info size={16} className="text-accent flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              Your data auto-saves to OneDrive as you work, similar to how Word saves documents.
              Backups run automatically after you make changes.
            </p>
            <p>
              <strong>Note:</strong> Image files are stored on the server and are not included in OneDrive backups.
              Only book data, chapters, characters, and other text content is backed up.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        onConfirm={handleRestoreConfirm}
        title="Restore from OneDrive?"
        message="This will replace all current data with the OneDrive backup. This cannot be undone."
        confirmLabel="Restore"
        variant="danger"
      />
    </div>
  );
}
