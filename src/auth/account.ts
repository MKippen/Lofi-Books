import type { AccountInfo } from '@azure/msal-browser';

type AccountLike = Pick<AccountInfo, 'homeAccountId' | 'localAccountId' | 'username' | 'name' | 'idTokenClaims'>;

interface TokenClaims {
  oid?: unknown;
  sub?: unknown;
}

export function getAccountUserId(account: AccountLike | null | undefined): string {
  const claims = account?.idTokenClaims as TokenClaims | undefined;

  if (typeof claims?.oid === 'string' && claims.oid) {
    return claims.oid;
  }

  if (typeof claims?.sub === 'string' && claims.sub) {
    return claims.sub;
  }

  return account?.localAccountId || account?.homeAccountId || '';
}

export function hasUsableAccountIdentity(account: AccountLike | null | undefined): boolean {
  const userId = getAccountUserId(account);
  // Consumer accounts may not return username/name in all flows
  // A valid userId alone is sufficient to consider the account usable
  return Boolean(userId);
}
