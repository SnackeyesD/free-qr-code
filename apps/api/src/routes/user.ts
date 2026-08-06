import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { getD1, fromBoolean, nowDb, type UserRow, type RefreshTokenRow } from '../lib/d1.js';
import { authMiddleware, toPublicUser, verifyPassword, hashPassword, extractAccessToken, parseAccessToken, sha256 } from '../services/auth.js';
import { updateMeSchema } from '../validators/user.js';
import type { AppContext, AppEnv } from '../types/index.js';

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

export const userRoutes = new Hono<AppEnv>();

userRoutes.get('/health', async (c) => {
  return c.json({ ok: true, env: c.env.API_BASE_URL });
});

userRoutes.use('*', authMiddleware as unknown as import('hono').MiddlewareHandler<AppEnv>);

userRoutes.get('/', async (c) => {
  const db = getD1(c.env);
  const row = await db.prepare('SELECT * FROM utilisateurs WHERE id = ?').bind(Number(c.get('userId')!)).first<UserRow>();
  if (!row) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  return c.json(toPublicUser(mapUser(row)));
});

userRoutes.patch('/', zValidator('json', updateMeSchema), async (c) => {
  const data = c.req.valid('json');
  const userId = Number(c.get('userId')!);
  const db = getD1(c.env);
  const row = await db.prepare('SELECT * FROM utilisateurs WHERE id = ?').bind(userId).first<UserRow>();
  if (!row) {
    throw new HTTPException(404, { message: 'User not found' });
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.nom !== undefined) {
    updates.push('nom = ?');
    values.push(data.nom);
  }
  if (data.consentementMarketing !== undefined) {
    updates.push('consentement_marketing = ?');
    updates.push('date_consentement_marketing = ?');
    values.push(fromBoolean(data.consentementMarketing));
    values.push(data.consentementMarketing ? nowDb() : null);
  }
  if (data.nouveauMotDePasse !== undefined) {
    const currentPassword = data.motDePasseActuel!;
    if (!(await verifyPassword(currentPassword, row.mot_de_passe))) {
      throw new HTTPException(401, { message: 'Invalid current password' });
    }
    updates.push('mot_de_passe = ?');
    values.push(await hashPassword(data.nouveauMotDePasse));
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    values.push(nowDb());
    const query = `UPDATE utilisateurs SET ${updates.join(', ')} WHERE id = ?`;
    values.push(userId);
    await db.prepare(query).bind(...values).run();
  }

  const updatedRow = await db.prepare('SELECT * FROM utilisateurs WHERE id = ?').bind(userId).first<UserRow>();
  if (!updatedRow) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  return c.json(toPublicUser(mapUser(updatedRow)));
});

userRoutes.get('/sessions', async (c) => {
  const userId = Number(c.get('userId')!);
  const db = getD1(c.env);
  const { results } = await db
    .prepare(
      'SELECT id, id_utilisateur, user_agent, adresse_ip, date_creation, date_derniere_utilisation, date_expiration FROM refresh_tokens WHERE id_utilisateur = ? AND date_revocation IS NULL ORDER BY date_creation DESC LIMIT 50',
    )
    .bind(userId)
    .all<Pick<RefreshTokenRow, 'id' | 'id_utilisateur' | 'user_agent' | 'adresse_ip' | 'date_creation' | 'date_derniere_utilisation' | 'date_expiration'>>();
  return c.json(
    (results ?? []).map((s) => ({
      id: s.id,
      userAgent: s.user_agent,
      ip: s.adresse_ip,
      createdAt: s.date_creation,
      lastUsedAt: s.date_derniere_utilisation,
      expiresAt: s.date_expiration,
    })),
  );
});

userRoutes.delete('/sessions/:id', async (c) => {
  const userId = Number(c.get('userId')!);
  const sessionId = Number(c.req.param('id'));
  if (!Number.isFinite(sessionId)) {
    throw new HTTPException(400, { message: 'Invalid session id' });
  }
  const db = getD1(c.env);
  const result = await db
    .prepare('UPDATE refresh_tokens SET date_revocation = ?, est_revoke = ? WHERE id = ? AND id_utilisateur = ?')
    .bind(nowDb(), 1, sessionId, userId)
    .run();
  if (!result.meta?.changes || result.meta.changes === 0) {
    throw new HTTPException(404, { message: 'Session not found' });
  }
  return c.json({ success: true });
});

userRoutes.delete('/sessions', async (c) => {
  const userId = Number(c.get('userId')!);
  const db = getD1(c.env);
  const accessToken = extractAccessToken(c);
  let currentJti: string | null = null;
  if (accessToken) {
    const payload = await parseAccessToken(c.env, accessToken);
    currentJti = payload?.jti ?? null;
  }
  if (currentJti) {
    const currentHash = await sha256(currentJti);
    await db
      .prepare(
        'UPDATE refresh_tokens SET date_revocation = ?, est_revoke = ? WHERE id_utilisateur = ? AND access_token_jti_hash != ? AND date_revocation IS NULL',
      )
      .bind(nowDb(), 1, userId, currentHash)
      .run();
  } else {
    await db
      .prepare('UPDATE refresh_tokens SET date_revocation = ?, est_revoke = ? WHERE id_utilisateur = ? AND date_revocation IS NULL')
      .bind(nowDb(), 1, userId)
      .run();
  }
  return c.json({ success: true });
});
