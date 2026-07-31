import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getD1, fromBoolean, type UserRow } from '../lib/d1.js';
import { authMiddleware, toPublicUser } from '../services/auth.js';
import type { AppEnv } from '../types/index.js';

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

userRoutes.get('/me', authMiddleware, async (c) => {
  const db = getD1(c.env);
  const row = await db.prepare('SELECT * FROM utilisateurs WHERE id = ?').bind(Number(c.get('userId')!)).first<UserRow>();
  if (!row) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  return c.json(toPublicUser(mapUser(row)));
});

userRoutes.get('/health', async (c) => {
  return c.json({ ok: true, env: c.env.API_BASE_URL });
});
