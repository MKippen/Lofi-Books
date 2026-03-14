import { type ReactNode } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import LoginPage from '@/features/auth/LoginPage';
import { useAuth } from '@/hooks/useAuth';

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const isBypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';
  const { inProgress } = useMsal();
  const { isAuthenticated } = useAuth();

  if (isBypassAuth) {
    return <>{children}</>;
  }

  if (inProgress !== InteractionStatus.None) {
    const label = inProgress === InteractionStatus.Startup ? 'Loading...' : 'Signing in...';
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-indigo/50 font-body text-sm">{label}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
