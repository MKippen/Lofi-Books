import { useMsal } from '@azure/msal-react';
import { graphScopes } from '@/auth/msalConfig';
import { useCallback, useEffect } from 'react';
import { hasUsableAccountIdentity } from '@/auth/account';

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
    }
  }, [instance, account]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (!isAuthenticated || !account) {
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
  }, [instance, account, isAuthenticated]);

  const logout = useCallback(async () => {
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
