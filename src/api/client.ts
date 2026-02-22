import { msalInstance } from '@/auth/msalInstance';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';

/** Get the current user's unique ID from MSAL (Azure AD OID). */
function getUserId(): string {
  const account = msalInstance.getActiveAccount();
  return account?.localAccountId ?? '';
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getUserId(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

/** Get the current user's ID for use in non-apiFetch contexts (e.g., image uploads). */
export { getUserId };
