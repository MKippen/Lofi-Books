import '@testing-library/jest-dom/vitest';
import { vi, beforeEach, afterEach } from 'vitest';

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
      localAccountId: 'test-user-id',
      username: 'test@example.com',
    }),
    acquireTokenSilent: () => Promise.resolve({ accessToken: 'mock-token' }),
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
