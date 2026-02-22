import { type ReactNode, useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { validateOneDriveAccess } from '@/utils/graphClient';
import { CloudOff, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';

interface OneDriveGateProps {
  children: ReactNode;
}

export default function OneDriveGate({ children }: OneDriveGateProps) {
  const { getAccessToken, logout } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChecked = useRef(false);

  const checkAccess = async () => {
    setChecking(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const ok = await validateOneDriveAccess(token);
      setHasAccess(ok);
      if (!ok) {
        setError(
          'Could not access your OneDrive. Make sure your Microsoft account has OneDrive enabled.',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('OneDrive gate error:', err);
      // If redirecting for a fresh token, don't show error — page will reload
      if (msg.includes('Redirecting')) return;
      setHasAccess(false);
      setError(msg);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-indigo/50 font-body text-sm">Connecting to OneDrive...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="bg-surface rounded-2xl shadow-xl border-2 border-secondary/30 p-8 max-w-md text-center">
          <CloudOff size={48} className="mx-auto text-secondary/50 mb-4" />
          <h2 className="font-heading text-xl text-indigo mb-2">
            OneDrive Connection Required
          </h2>
          <p className="text-indigo/50 text-sm mb-6">
            {error || 'Lofi Books needs OneDrive to keep your stories safe. Please try again.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="ghost" size="sm" onClick={logout}>
              Sign Out
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                hasChecked.current = false;
                checkAccess();
              }}
            >
              <RefreshCw size={16} />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
