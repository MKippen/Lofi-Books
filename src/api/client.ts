import { msalInstance } from '@/auth/msalInstance';
import { loginRequest } from '@/auth/msalConfig';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';

/** Get the current user's unique ID from MSAL (Azure AD OID). */
function getUserId(): string {
  return msalInstance.getActiveAccount()?.localAccountId ?? '';
}

/** Acquire an ID token silently for Bearer auth. ID token has aud:clientId — validatable server-side. */
async function getBearerToken(): Promise<string> {
  const account = msalInstance.getActiveAccount();
  if (!account) return '';
  try {
    const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    return result.idToken;
  } catch {
    return '';
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getBearerToken();
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getUserId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
