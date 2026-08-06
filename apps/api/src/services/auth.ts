import { HTTPException } from 'hono/http-exception';
import { SignJWT, jwtVerify } from 'jose';
import * as bcrypt from 'bcryptjs';
import type { AppContext, AppEnv, TokenPair } from '../types/index.js';

export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

export function getAccessSecret(env: AppEnv['Bindings']): Uint8Array {
  return new TextEncoder().encode(env.JWT_ACCESS_SECRET);
}

export function getRefreshSecret(env: AppEnv['Bindings']): Uint8Array {
  return new TextEncoder().encode(env.JWT_REFRESH_SECRET);
}

export function getAccessTtlSeconds(env: AppEnv['Bindings']): number {
  return parseInt(env.ACCESS_TOKEN_TTL_SECONDS, 10) || 900;
}

export function getRefreshTtlSeconds(env: AppEnv['Bindings']): number {
  const days = parseInt(env.REFRESH_TOKEN_TTL_DAYS, 10) || 7;
  return days * 24 * 60 * 60;
}

export async function createAccessToken(env: AppEnv['Bindings'], userId: string, role: string): Promise<{ token: string; jti: string; expiresAt: number }> {
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + getAccessTtlSeconds(env);
  const token = await new SignJWT({ sub: userId, role, jti })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setAudience('free-qr-code-api')
    .setIssuer('free-qr-code-api')
    .sign(getAccessSecret(env));
  return { token, jti, expiresAt: exp };
}

export async function createRefreshToken(env: AppEnv['Bindings'], userId: string): Promise<{ token: string; jti: string; expiresAt: number }> {
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + getRefreshTtlSeconds(env);
  const token = await new SignJWT({ sub: userId, jti })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setAudience('free-qr-code-refresh')
    .setIssuer('free-qr-code-api')
    .sign(getRefreshSecret(env));
  return { token, jti, expiresAt: exp };
}

export async function createTokenPair(env: AppEnv['Bindings'], userId: string, role: string): Promise<TokenPair & { accessJti: string; refreshJti: string }> {
  const access = await createAccessToken(env, userId, role);
  const refresh = await createRefreshToken(env, userId);
  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessExpiresAt: access.expiresAt,
    refreshExpiresAt: refresh.expiresAt,
    accessJti: access.jti,
    refreshJti: refresh.jti,
  };
}

export async function verifyAccessToken(env: AppEnv['Bindings'], token: string): Promise<{ userId: string; role: string; jti: string }> {
  try {
    const { payload } = await jwtVerify(token, getAccessSecret(env), {
      algorithms: ['HS256'],
      audience: 'free-qr-code-api',
      issuer: 'free-qr-code-api',
    });
    if (!payload.sub || !payload.role || !payload.jti) {
      throw new HTTPException(401, { message: 'Invalid access token payload' });
    }
    return { userId: String(payload.sub), role: String(payload.role), jti: String(payload.jti) };
  } catch (err) {
    throw new HTTPException(401, { message: 'Invalid or expired access token' });
  }
}

export async function parseAccessToken(env: AppEnv['Bindings'], token: string): Promise<{ userId: string; role: string; jti: string } | null> {
  try {
    return await verifyAccessToken(env, token);
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(env: AppEnv['Bindings'], token: string): Promise<{ userId: string; jti: string }> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecret(env), {
      algorithms: ['HS256'],
      audience: 'free-qr-code-refresh',
      issuer: 'free-qr-code-api',
    });
    if (!payload.sub || !payload.jti) {
      throw new HTTPException(401, { message: 'Invalid refresh token payload' });
    }
    return { userId: String(payload.sub), jti: String(payload.jti) };
  } catch (err) {
    throw new HTTPException(401, { message: 'Invalid or expired refresh token' });
  }
}

export function setAuthCookies(c: AppContext, pair: TokenPair) {
  const isSecure = !c.env.API_BASE_URL?.startsWith('http://localhost');
  const sameSite = isSecure ? 'Lax' : 'Lax';
  const secureFlag = isSecure ? 'Secure;' : '';
  c.header('Set-Cookie', `accessToken=${pair.accessToken}; HttpOnly; ${secureFlag} SameSite=${sameSite}; Path=/; Max-Age=${pair.accessExpiresAt - Math.floor(Date.now() / 1000)}`, { append: true });
  c.header('Set-Cookie', `refreshToken=${pair.refreshToken}; HttpOnly; ${secureFlag} SameSite=${sameSite}; Path=/auth/refresh; Max-Age=${pair.refreshExpiresAt - Math.floor(Date.now() / 1000)}`, { append: true });
}

export function clearAuthCookies(c: AppContext) {
  const isSecure = !c.env.API_BASE_URL?.startsWith('http://localhost');
  const secureFlag = isSecure ? 'Secure;' : '';
  c.header('Set-Cookie', `accessToken=; HttpOnly; ${secureFlag} SameSite=Lax; Path=/; Max-Age=0`, { append: true });
  c.header('Set-Cookie', `refreshToken=; HttpOnly; ${secureFlag} SameSite=Lax; Path=/auth/refresh; Max-Age=0`, { append: true });
}

export async function authMiddleware(c: AppContext, next: () => Promise<void>) {
  const header = c.req.header('Authorization');
  const cookie = c.req.header('Cookie');
  let token: string | null = null;
  if (header?.startsWith('Bearer ')) {
    token = header.slice(7).trim();
  } else if (cookie) {
    const match = cookie.match(/(?:^|;\s*)accessToken=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) {
    throw new HTTPException(401, { message: 'Missing access token' });
  }
  const { userId, role, jti } = await verifyAccessToken(c.env, token);
  c.set('userId', userId);
  c.set('role', role);
  c.set('jti', jti);
  await next();
}

export function extractAccessToken(c: AppContext): string | null {
  const header = c.req.header('Authorization');
  const cookie = c.req.header('Cookie');
  let token: string | null = null;
  if (header?.startsWith('Bearer ')) {
    token = header.slice(7).trim();
  } else if (cookie) {
    const match = cookie.match(/(?:^|;\s*)accessToken=([^;]+)/);
    if (match) token = match[1];
  }
  return token;
}

export function requireAdmin(c: AppContext, next: () => Promise<void>) {
  if (c.get('role') !== 'admin') {
    throw new HTTPException(403, { message: 'Admin access required' });
  }
  return next();
}

export function extractRefreshTokenFromCookie(c: AppContext): string | null {
  const cookie = c.req.header('Cookie');
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)refreshToken=([^;]+)/);
  return match ? match[1] : null;
}

export function toPublicUser(user: { id: number; email: string; nom: string; estVerifie: boolean; consentementMarketing: boolean; dateInscription: string; role: 'utilisateur' | 'admin' }) {
  return {
    id: String(user.id),
    email: user.email,
    nom: user.nom,
    estVerifie: user.estVerifie,
    consentementMarketing: user.consentementMarketing,
    dateInscription: user.dateInscription,
    role: user.role,
  };
}
