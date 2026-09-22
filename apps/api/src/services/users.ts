import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../types/index.js';
import type { RoleUtilisateur, Utilisateur } from '@free-qr/shared-types';
import { d1All, d1First, d1Run } from '../lib/db.js';
import type { UserRow } from '../lib/d1.js';

export interface ListUsersFilters {
  page: number;
  limit: number;
  search?: string;
  role?: RoleUtilisateur;
}

function toAdminUser(row: UserRow): Utilisateur {
  return {
    id: String(row.id),
    email: row.email,
    nom: row.nom,
    estVerifie: row.est_verifie === 1,
    consentementMarketing: row.consentement_marketing === 1,
    dateInscription: row.date_inscription,
    dateDerniereConnexion: row.date_derniere_connexion ?? undefined,
    estActif: row.est_actif === 1,
    role: row.role,
  };
}

export async function listUsers(
  env: AppEnv['Bindings'],
  filters: ListUsersFilters
): Promise<{ data: Utilisateur[]; total: number }> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.role) {
    conditions.push('role = ?');
    params.push(filters.role);
  }
  if (filters.search) {
    conditions.push('(nom LIKE ? OR email LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filters.limit, 1), 100);
  const offset = (Math.max(filters.page, 1) - 1) * limit;

  const rows = await d1All<UserRow>(
    env,
    `SELECT * FROM utilisateurs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset
  );
  const countRow = await d1First<{ total: number }>(
    env,
    `SELECT COUNT(*) AS total FROM utilisateurs ${where}`,
    ...params
  );
  return {
    data: rows.map(toAdminUser),
    total: countRow?.total ?? 0,
  };
}

export async function getUserById(env: AppEnv['Bindings'], id: number): Promise<Utilisateur> {
  const row = await d1First<UserRow>(env, 'SELECT * FROM utilisateurs WHERE id = ?', id);
  if (!row) throw new HTTPException(404, { message: 'Utilisateur non trouvé' });
  return toAdminUser(row);
}

export async function updateUser(
  env: AppEnv['Bindings'],
  id: number,
  input: { estActif?: boolean; role?: RoleUtilisateur }
): Promise<Utilisateur> {
  const existing = await d1First<UserRow>(env, 'SELECT id FROM utilisateurs WHERE id = ?', id);
  if (!existing) throw new HTTPException(404, { message: 'Utilisateur non trouvé' });

  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (input.estActif !== undefined) {
    sets.push('est_actif = ?');
    params.push(input.estActif ? 1 : 0);
  }
  if (input.role !== undefined) {
    sets.push('role = ?');
    params.push(input.role);
  }
  await d1Run(env, `UPDATE utilisateurs SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
  return getUserById(env, id);
}

export async function deleteUser(env: AppEnv['Bindings'], id: number): Promise<boolean> {
  const result = await d1Run(env, 'DELETE FROM utilisateurs WHERE id = ?', id);
  return (result.meta?.changes ?? 0) > 0;
}
