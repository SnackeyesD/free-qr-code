import { rateLimitMiddleware } from '../middlewares/rate-limit.js';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { getD1, nowDb, fromBoolean, type UserRow, type RefreshTokenRow } from '../lib/d1.js';
import {
  hashPassword,
  verifyPassword,
  createTokenPair,
  setAuthCookies,
  clearAuthCookies,
  verifyRefreshToken,
  sha256,
  extractRefreshTokenFromCookie,
  toPublicUser,
  authMiddleware,
} from '../services/auth.js';
import type { AppContext, AppEnv } from '../types/index.js';

const registerSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  motDePasse: z.string().min(8),
  nom: z.string().min(1).transform((v) => v.trim()),
  consentementMarketing: z.boolean(),
});

const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  motDePasse: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  motDePasse: z.string().min(8),
});

export const authRoutes = new Hono<AppEnv>();

authRoutes.use('/register', rateLimitMiddleware as import('hono').MiddlewareHandler<AppEnv>);
authRoutes.use('/login', rateLimitMiddleware as import('hono').MiddlewareHandler<AppEnv>);
authRoutes.use('/refresh', rateLimitMiddleware as import('hono').MiddlewareHandler<AppEnv>);
authRoutes.use('/forgot-password', rateLimitMiddleware as import('hono').MiddlewareHandler<AppEnv>);
authRoutes.use('/reset-password', rateLimitMiddleware as import('hono').MiddlewareHandler<AppEnv>);

export function getClientIp(c: AppContext): string {
  const cf = c.req.header('CF-Connecting-IP');
  if (cf) return cf;
  const xff = c.req.header('X-Forwarded-For');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

async function getClientInfo(c: AppContext) {
  return {
    ip: getClientIp(c),
    userAgent: c.req.header('User-Agent') ?? 'unknown',
  };
}

function mapUser(row: UserRow) {
  return {
    id: row.id,
    publicId: row.public_id,
    email: row.email,
    nom: row.nom,
    estVerifie: row.est_verifie === 1,
    consentementMarketing: row.consentement_marketing === 1,
    dateInscription: row.date_inscription,
    estActif: row.est_actif === 1,
    role: row.role,
    motDePasse: row.mot_de_passe,
    dateDerniereConnexion: row.date_derniere_connexion,
  };
}

function userPublicFromRow(row: UserRow) {
  return toPublicUser(mapUser(row));
}

authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const data = c.req.valid('json');
  const db = getD1(c.env);
  const existing = await db.prepare('SELECT id FROM utilisateurs WHERE email = ?').bind(data.email.toLowerCase().trim()).first<{ id: number }>();
  if (existing) {
    throw new HTTPException(409, { message: 'Email already used' });
  }
  const now = nowDb();
  const hashed = await hashPassword(data.motDePasse);
  const result = await db
    .prepare(
      'INSERT INTO utilisateurs (public_id, email, mot_de_passe, nom, est_verifie, consentement_marketing, date_consentement_marketing, date_inscription, est_actif, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      crypto.randomUUID(),
      data.email.toLowerCase().trim(),
      hashed,
      data.nom.trim(),
      0,
      fromBoolean(data.consentementMarketing),
      data.consentementMarketing ? now : null,
      now,
      1,
      'utilisateur'
    )
    .run();
  const userId = result.meta?.last_row_id ?? 0;
  if (!userId) {
    throw new HTTPException(500, { message: 'Failed to create user' });
  }
  const pair = await createTokenPair(c.env, String(userId), 'utilisateur');
  const { ip, userAgent } = await getClientInfo(c);
  const refreshTokenHash = await sha256(pair.refreshToken);
  await db
    .prepare(
      'INSERT INTO refresh_tokens (public_id, id_utilisateur, token_hash, user_agent, adresse_ip, date_creation, date_expiration, est_revoke) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(crypto.randomUUID(), userId, refreshTokenHash, userAgent, ip, nowDb(), new Date(pair.refreshExpiresAt * 1000).toISOString(), 0)
    .run();
  // Jeton de vérification email (24h). Sans SMTP configuré, l'utilisateur
  // le récupère via un renvoi / debug ; le login reste bloqué tant que
  // est_verifie = 0.
  await db
    .prepare(
      'INSERT INTO tokens_email (public_id, id_utilisateur, token_hash, type, date_expiration, est_utilise) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(
      crypto.randomUUID(),
      userId,
      crypto.randomUUID(),
      'verification',
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      0
    )
    .run();
  setAuthCookies(c, pair);
  return c.json(
    {
      accessToken: pair.accessToken,
      expiresAt: pair.accessExpiresAt,
      user: {
        id: String(userId),
        email: data.email.toLowerCase().trim(),
        nom: data.nom.trim(),
        estVerifie: false,
        consentementMarketing: data.consentementMarketing,
        dateInscription: now,
        role: 'utilisateur',
      },
    },
    201
  );
});

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const data = c.req.valid('json');
  const db = getD1(c.env);
  const row = await db.prepare('SELECT * FROM utilisateurs WHERE email = ?').bind(data.email.toLowerCase().trim()).first<UserRow>();
  if (!row || !(await verifyPassword(data.motDePasse, row.mot_de_passe))) {
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }
  const user = mapUser(row);
  if (!user.estVerifie) {
    throw new HTTPException(401, { message: 'Email not verified' });
  }
  if (!user.estActif) {
    throw new HTTPException(401, { message: 'Account disabled' });
  }
  await db.prepare('UPDATE utilisateurs SET date_derniere_connexion = ? WHERE id = ?').bind(nowDb(), user.id).run();
  const pair = await createTokenPair(c.env, String(user.id), user.role);
  const { ip, userAgent } = await getClientInfo(c);
  const refreshTokenHash = await sha256(pair.refreshToken);
  await db
    .prepare(
      'INSERT INTO refresh_tokens (public_id, id_utilisateur, token_hash, user_agent, adresse_ip, date_creation, date_expiration, est_revoke) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(crypto.randomUUID(), user.id, refreshTokenHash, userAgent, ip, nowDb(), new Date(pair.refreshExpiresAt * 1000).toISOString(), 0)
    .run();
  setAuthCookies(c, pair);
  return c.json({
    accessToken: pair.accessToken,
    expiresAt: pair.accessExpiresAt,
    user: userPublicFromRow(row),
  });
});

authRoutes.post('/refresh', async (c) => {
  const cookieToken = extractRefreshTokenFromCookie(c);
  if (!cookieToken) {
    throw new HTTPException(401, { message: 'Missing refresh token' });
  }
  const { userId, jti } = await verifyRefreshToken(c.env, cookieToken);
  const db = getD1(c.env);
  const tokenHash = await sha256(cookieToken);
  const stored = await db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').bind(tokenHash).first<RefreshTokenRow>();
  if (!stored || stored.est_revoke === 1 || String(stored.id_utilisateur) !== userId) {
    throw new HTTPException(401, { message: 'Refresh token revoked or invalid' });
  }
  const userRow = await db.prepare('SELECT * FROM utilisateurs WHERE id = ?').bind(stored.id_utilisateur).first<UserRow>();
  if (!userRow || userRow.est_actif !== 1) {
    throw new HTTPException(401, { message: 'Account disabled' });
  }
  const user = mapUser(userRow);
  await db.prepare('UPDATE refresh_tokens SET est_revoke = ?, date_revocation = ? WHERE token_hash = ?').bind(1, nowDb(), tokenHash).run();
  const pair = await createTokenPair(c.env, String(user.id), user.role);
  const { ip, userAgent } = await getClientInfo(c);
  const newRefreshTokenHash = await sha256(pair.refreshToken);
  await db
    .prepare(
      'INSERT INTO refresh_tokens (public_id, id_utilisateur, token_hash, user_agent, adresse_ip, date_creation, date_expiration, est_revoke) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(crypto.randomUUID(), user.id, newRefreshTokenHash, userAgent, ip, nowDb(), new Date(pair.refreshExpiresAt * 1000).toISOString(), 0)
    .run();
  setAuthCookies(c, pair);
  return c.json({
    accessToken: pair.accessToken,
    expiresAt: pair.accessExpiresAt,
  });
});

authRoutes.post('/logout', authMiddleware, async (c) => {
  const cookieToken = extractRefreshTokenFromCookie(c);
  const db = getD1(c.env);
  if (cookieToken) {
    const tokenHash = await sha256(cookieToken);
    await db
      .prepare('UPDATE refresh_tokens SET est_revoke = ?, date_revocation = ? WHERE token_hash = ? AND id_utilisateur = ?')
      .bind(1, nowDb(), tokenHash, Number(c.get('userId')))
      .run();
  }
  clearAuthCookies(c);
  return c.json({ success: true });
});

authRoutes.get('/sessions', authMiddleware, async (c) => {
  const db = getD1(c.env);
  const { results } = await db
    .prepare('SELECT token_hash, date_creation, user_agent, est_revoke FROM refresh_tokens WHERE id_utilisateur = ? ORDER BY date_creation DESC LIMIT 50')
    .bind(Number(c.get('userId')))
    .all<Pick<RefreshTokenRow, 'token_hash' | 'date_creation' | 'user_agent' | 'est_revoke'>>();
  return c.json(
    (results ?? []).map((s) => ({
      tokenHash: s.token_hash,
      dateCreation: s.date_creation,
      userAgent: s.user_agent,
      estRevoke: s.est_revoke === 1,
    }))
  );
});

authRoutes.delete('/sessions/:tokenHash', authMiddleware, async (c) => {
  const tokenHash = c.req.param('tokenHash');
  const db = getD1(c.env);
  const result = await db
    .prepare('UPDATE refresh_tokens SET est_revoke = ?, date_revocation = ? WHERE token_hash = ? AND id_utilisateur = ?')
    .bind(1, nowDb(), tokenHash, Number(c.get('userId')))
    .run();
  if (!result.meta?.changes || result.meta.changes === 0) {
    throw new HTTPException(404, { message: 'Session not found' });
  }
  return c.json({ success: true });
});

authRoutes.post('/verify-email', zValidator('json', verifyEmailSchema), async (c) => {
  const { token } = c.req.valid('json');
  const db = getD1(c.env);
  const tokenRow = await db.prepare('SELECT * FROM tokens_email WHERE token_hash = ? AND type = ? AND est_utilise = ?').bind(token, 'verification', 0).first<{
    id: number;
    id_utilisateur: number;
    date_expiration: string;
  }>();
  if (!tokenRow) {
    throw new HTTPException(400, { message: 'Invalid or expired verification token' });
  }
  if (new Date(tokenRow.date_expiration) < new Date()) {
    throw new HTTPException(400, { message: 'Verification token expired' });
  }
  await db.prepare('UPDATE utilisateurs SET est_verifie = ? WHERE id = ?').bind(1, tokenRow.id_utilisateur).run();
  await db.prepare('UPDATE tokens_email SET est_utilise = ? WHERE id = ?').bind(1, tokenRow.id).run();
  const userRow = await db.prepare('SELECT * FROM utilisateurs WHERE id = ?').bind(tokenRow.id_utilisateur).first<UserRow>();
  if (!userRow) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  const user = mapUser(userRow);
  const pair = await createTokenPair(c.env, String(user.id), user.role);
  const { ip, userAgent } = await getClientInfo(c);
  const refreshTokenHash = await sha256(pair.refreshToken);
  await db
    .prepare(
      'INSERT INTO refresh_tokens (public_id, id_utilisateur, token_hash, user_agent, adresse_ip, date_creation, date_expiration, est_revoke) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(crypto.randomUUID(), user.id, refreshTokenHash, userAgent, ip, nowDb(), new Date(pair.refreshExpiresAt * 1000).toISOString(), 0)
    .run();
  setAuthCookies(c, pair);
  return c.json({
    accessToken: pair.accessToken,
    expiresAt: pair.accessExpiresAt,
    user: userPublicFromRow(userRow),
  });
});

authRoutes.post('/forgot-password', zValidator('json', forgotPasswordSchema), async (c) => {
  const { email } = c.req.valid('json');
  const db = getD1(c.env);
  // Réponse uniforme (anti-énumération) : 200 même si l'email est inconnu.
  const userRow = await db
    .prepare('SELECT id FROM utilisateurs WHERE email = ?')
    .bind(email)
    .first<{ id: number }>();
  if (userRow) {
    await db
      .prepare(
        'INSERT INTO tokens_email (public_id, id_utilisateur, token_hash, type, date_expiration, est_utilise) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(
        crypto.randomUUID(),
        userRow.id,
        crypto.randomUUID(),
        'reinitialisation',
        new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        0
      )
      .run();
  }
  return c.json({ success: true });
});

authRoutes.post('/reset-password', zValidator('json', resetPasswordSchema), async (c) => {
  const { token, motDePasse } = c.req.valid('json');
  const db = getD1(c.env);
  const tokenRow = await db
    .prepare('SELECT id, id_utilisateur, date_expiration FROM tokens_email WHERE token_hash = ? AND type = ? AND est_utilise = ?')
    .bind(token, 'reinitialisation', 0)
    .first<{ id: number; id_utilisateur: number; date_expiration: string }>();
  if (!tokenRow) {
    throw new HTTPException(400, { message: 'Invalid or expired reset token' });
  }
  if (new Date(tokenRow.date_expiration) < new Date()) {
    throw new HTTPException(400, { message: 'Reset token expired' });
  }
  const hashed = await hashPassword(motDePasse);
  await db.prepare('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?').bind(hashed, tokenRow.id_utilisateur).run();
  await db.prepare('UPDATE tokens_email SET est_utilise = ?, date_utilisation = ? WHERE id = ?').bind(1, nowDb(), tokenRow.id).run();
  // Le mot de passe ayant changé, toutes les sessions existantes sont révoquées.
  await db
    .prepare('UPDATE refresh_tokens SET est_revoke = ?, date_revocation = ? WHERE id_utilisateur = ? AND est_revoke = ?')
    .bind(1, nowDb(), tokenRow.id_utilisateur, 0)
    .run();
  return c.json({ success: true });
});
