import '@testing-library/jest-dom/vitest';
import { vi, beforeEach, afterEach } from 'vitest';

vi.stubEnv('VITE_BYPASS_AUTH', 'false');

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      BASE_URL: '/',
    },
  },
});

// Mock MSAL instance
vi.mock('@/auth/msalInstance', () => ({
  msalInstance: {
    getActiveAccount: () => ({
      localAccountId: 'test-local-account-id',
      homeAccountId: 'test-home-account-id',
      username: 'test@example.com',
      name: 'Test User',
      idTokenClaims: {
        oid: 'test-oid',
      },
    }),
    getAllAccounts: () => ([{
      localAccountId: 'test-local-account-id',
      homeAccountId: 'test-home-account-id',
      username: 'test@example.com',
      name: 'Test User',
      idTokenClaims: {
        oid: 'test-oid',
      },
    }]),
    acquireTokenSilent: () => Promise.resolve({ accessToken: 'mock-token', idToken: 'mock-id-token' }),
    loginPopup: () => Promise.resolve({}),
    loginRedirect: () => Promise.resolve(),
    logoutPopup: () => Promise.resolve(),
    logoutRedirect: () => Promise.resolve(),
  },
}));

// Mock fetch globally
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn();
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});
