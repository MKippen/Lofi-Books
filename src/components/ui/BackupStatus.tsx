import { CloudOff, Cloud, CloudUpload, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import type { BackupState } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface BackupStatusProps {
  state: BackupState;
  onManualBackup: () => void;
  variant?: 'sidebar' | 'page';
}

export default function BackupStatus({ state, onManualBackup, variant = 'sidebar' }: BackupStatusProps) {
  const { status, lastBackupTime, lastBackupError, isOneDriveConnected } = state;

  const isSidebar = variant === 'sidebar';

  if (!isOneDriveConnected) {
    return (
      <div className={`px-3 py-2 rounded-xl text-xs ${
        isSidebar ? 'bg-red-500/10 text-red-400' : 'bg-red-500/10 text-red-600'
      }`}>
        <button
          type="button"
          onClick={onManualBackup}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80"
        >
          <CloudOff size={14} className="flex-shrink-0" />
          <span>OneDrive disconnected</span>
        </button>
        {lastBackupError && (
          <p className="mt-1 opacity-60 text-[10px] break-words">{lastBackupError}</p>
        )}
      </div>
    );
  }

  const statusConfig = {
    idle: {
      icon: Cloud,
      text: lastBackupTime
        ? `Backed up ${formatDistanceToNow(lastBackupTime, { addSuffix: true })}`
        : 'Connected',
      className: isSidebar ? 'text-white/40' : 'text-indigo/40',
    },
    'backing-up': {
      icon: CloudUpload,
      text: 'Backing up...',
      className: 'text-primary animate-pulse',
    },
    restoring: {
      icon: RotateCcw,
      text: 'Restoring...',
      className: 'text-accent animate-spin',
    },
    success: {
      icon: CheckCircle2,
      text: 'Saved to OneDrive',
      className: isSidebar ? 'text-[#B8CFA8]' : 'text-primary',
    },
    error: {
      icon: AlertCircle,
      text: lastBackupError ?? 'Backup error',
      className: 'text-secondary',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onManualBackup}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
        isSidebar ? 'hover:bg-white/[0.06]' : 'hover:bg-primary/10'
      } ${config.className}`}
      title="Click to backup now"
    >
      <Icon size={14} />
      <span className="truncate max-w-[140px]">{config.text}</span>
    </button>
  );
}
