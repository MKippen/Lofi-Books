import { useMsal } from '@azure/msal-react';
import { graphScopes } from '@/auth/msalConfig';
import { useCallback, useEffect } from 'react';
import { hasUsableAccountIdentity } from '@/auth/account';
import { logClientTelemetry } from '@/api/telemetry';

export type UserRole = 'admin' | 'user';

// Admin emails — Dad (Mike) is admin, everyone else is a regular user
const ADMIN_EMAILS: string[] = [
  // Add Mike's Microsoft email here after first login
  // e.g. 'mike@outlook.com'
];

export function useAuth() {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() ?? accounts.find(hasUsableAccountIdentity) ?? null;
  const isAuthenticated = hasUsableAccountIdentity(account);

  useEffect(() => {
    if (!instance.getActiveAccount() && account) {
      instance.setActiveAccount(account);
      logClientTelemetry('auth_active_account_promoted', {
        accountCount: accounts.length,
      }, { scope: 'auth' });
    }
  }, [instance, account, accounts.length]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (!isAuthenticated || !account) {
      logClientTelemetry('auth_access_token_requested_without_account', {
        accountCount: accounts.length,
      }, { scope: 'auth', severity: 'warn' });
      throw new Error('No authenticated account');
    }

    try {
      const response = await instance.acquireTokenSilent({
        ...graphScopes,
        account,
      });
      logClientTelemetry('auth_access_token_silent_success', undefined, { scope: 'auth', severity: 'debug' });
      return response.accessToken;
    } catch (silentErr) {
      console.warn('Silent token acquisition failed, trying popup:', silentErr);
      logClientTelemetry('auth_access_token_silent_failed', {
        errorMessage: silentErr instanceof Error ? silentErr.message : String(silentErr),
      }, { scope: 'auth', severity: 'warn' });
      try {
        const response = await instance.acquireTokenPopup(graphScopes);
        logClientTelemetry('auth_access_token_popup_success', undefined, { scope: 'auth' });
        return response.accessToken;
      } catch (popupErr) {
        console.error('Token acquisition failed:', popupErr);
        logClientTelemetry('auth_access_token_popup_failed', {
          errorMessage: popupErr instanceof Error ? popupErr.message : String(popupErr),
        }, { scope: 'auth', severity: 'error' });
        throw popupErr;
      }
    }
  }, [instance, account, isAuthenticated, accounts.length]);

  const logout = useCallback(async () => {
    logClientTelemetry('auth_logout_requested', undefined, { scope: 'auth' });
    await instance.logoutRedirect();
  }, [instance]);

  const email = account?.username ?? '';
  const role: UserRole = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'user';

  return {
    account: isAuthenticated ? account : null,
    displayName: isAuthenticated ? (account?.name ?? account?.username ?? 'User') : '',
    email: isAuthenticated ? email : '',
    role,
    isAdmin: role === 'admin',
    getAccessToken,
    logout,
    isAuthenticated,
  };
}
