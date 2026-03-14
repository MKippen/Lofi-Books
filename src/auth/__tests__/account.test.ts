import { describe, expect, it } from 'vitest';
import { getAccountUserId, hasUsableAccountIdentity } from '../account';

describe('account auth helpers', () => {
  it('prefers oid for the stable user id', () => {
    expect(getAccountUserId({
      homeAccountId: 'home-id',
      localAccountId: 'local-id',
      username: 'user@example.com',
      name: 'User',
      idTokenClaims: { oid: 'oid-id', sub: 'sub-id' },
    })).toBe('oid-id');
  });

  it('falls back to sub when oid is missing', () => {
    expect(getAccountUserId({
      homeAccountId: 'home-id',
      localAccountId: 'local-id',
      username: 'user@example.com',
      name: 'User',
      idTokenClaims: { sub: 'sub-id' },
    })).toBe('sub-id');
  });

  it('rejects phantom sessions with no display identity', () => {
    expect(hasUsableAccountIdentity({
      homeAccountId: 'home-id',
      localAccountId: 'local-id',
      username: '',
      name: '',
      idTokenClaims: { oid: 'oid-id' },
    })).toBe(false);
  });
});
