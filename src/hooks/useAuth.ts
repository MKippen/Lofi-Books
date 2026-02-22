import { useMsal, useAccount } from '@azure/msal-react';
import { graphScopes } from '@/auth/msalConfig';
import { useCallback } from 'react';

export type UserRole = 'admin' | 'user';

// Admin emails — Dad (Mike) is admin, everyone else is a regular user
const ADMIN_EMAILS: string[] = [
  // Add Mike's Microsoft email here after first login
  // e.g. 'mike@outlook.com'
];

export function useAuth() {
  const { instance, accounts } = useMsal();
  const account = useAccount(accounts[0] ?? null);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (!account) {
      throw new Error('No authenticated account');
    }

    try {
      const response = await instance.acquireTokenSilent({
        ...graphScopes,
        account,
      });
      return response.accessToken;
    } catch (silentErr) {
      console.warn('Silent token acquisition failed, trying popup:', silentErr);
      try {
        const response = await instance.acquireTokenPopup(graphScopes);
        return response.accessToken;
      } catch (popupErr) {
        console.error('Token acquisition failed:', popupErr);
        throw popupErr;
      }
    }
  }, [instance, account]);

  const logout = useCallback(async () => {
    await instance.logoutRedirect();
  }, [instance]);

  const email = account?.username ?? '';
  const role: UserRole = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'user';

  return {
    account,
    displayName: account?.name ?? account?.username ?? 'User',
    email,
    role,
    isAdmin: role === 'admin',
    getAccessToken,
    logout,
    isAuthenticated: !!account,
  };
}
