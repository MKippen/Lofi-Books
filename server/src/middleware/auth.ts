import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// JWKS client — caches keys and transparently follows Microsoft's key rotation.
// No secrets needed: validation uses Microsoft's public keys only.
const client = jwksClient({
  jwksUri: 'https://login.microsoftonline.com/consumers/discovery/v2.0/keys',
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key?.getPublicKey());
  });
}

// Consumers tenant ID (personal Microsoft accounts)
const CONSUMERS_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  jwt.verify(
    token,
    getKey,
    {
      audience: process.env.MSAL_CLIENT_ID,
      issuer: `https://login.microsoftonline.com/${CONSUMERS_TENANT}/v2.0`,
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (err) {
        console.warn('JWT verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid token' });
      }
      const claims = decoded as jwt.JwtPayload;
      (req as any).userId = claims.oid || claims.sub || '';
      (req as any).userEmail = claims.preferred_username || '';
      next();
    },
  );
}
