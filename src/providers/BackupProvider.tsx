import { createContext, useContext, type ReactNode } from 'react';
import { useOneDriveBackup } from '@/hooks/useOneDriveBackup';
import RestoreDialog from '@/components/ui/RestoreDialog';
import type { BackupState } from '@/types';

interface BackupContextValue {
  state: BackupState;
  manualBackup: () => void;
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
    showRestoreDialog,
    remoteMetadata,
    doRestore,
    dismissRestoreDialog,
    manualBackup,
  } = useOneDriveBackup();

  const state: BackupState = {
    status,
    lastBackupTime,
    lastBackupError,
    isOneDriveConnected,
  };

  return (
    <BackupContext.Provider value={{ state, manualBackup }}>
      {children}
      <RestoreDialog
        isOpen={showRestoreDialog}
        onClose={dismissRestoreDialog}
        onRestore={doRestore}
        metadata={remoteMetadata}
      />
    </BackupContext.Provider>
  );
}
