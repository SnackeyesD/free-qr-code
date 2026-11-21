import { HTTPException } from 'hono/http-exception';
import { sha256 } from './auth.js';
import { d1All, d1First, d1Run } from '../lib/db.js';
import type { AppEnv } from '../types/index.js';
import type { CleApi, CleApiCreee, PermissionCleApi } from '@free-qr/shared-types';
import type { ApiKeyRow } from '../lib/d1.js';

const KEY_PREFIX_LENGTH = 8;
const KEY_SECRET_LENGTH = 32;
const ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateRandomString(length: number): string {
  let result = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    result += ALPHANUM[bytes[i] % ALPHANUM.length];
  }
  return result;
}

export interface GeneratedApiKey {
  prefix: string;
  secret: string;
  fullKey: string;
  hash: string;
}

export async function generateApiKey(): Promise<GeneratedApiKey> {
  const prefix = generateRandomString(KEY_PREFIX_LENGTH);
  const secret = generateRandomString(KEY_SECRET_LENGTH);
  const fullKey = `${prefix}${secret}`;
  return { prefix, secret, fullKey, hash: await sha256(secret) };
}

export function buildStoredKey(prefix: string, secretHash: string): string {
  return `${prefix}${secretHash}`;
}

export function parseApiKey(key: string): { prefix: string; secret: string } | null {
  if (key.length <= KEY_PREFIX_LENGTH) return null;
  const prefix = key.slice(0, KEY_PREFIX_LENGTH);
  const secret = key.slice(KEY_PREFIX_LENGTH);
  if (!/^[a-z0-9]+$/.test(prefix) || !/^[a-z0-9]+$/.test(secret)) return null;
  return { prefix, secret };
}

export interface CreateApiKeyInput {
  nom: string;
  permissions?: PermissionCleApi[];
  dateExpiration?: string;
}

function toPublicApiKey(row: ApiKeyRow): CleApi {
  const prefix = row.cle.slice(0, KEY_PREFIX_LENGTH);
  return {
    id: row.public_id,
    idUtilisateur: String(row.id_utilisateur),
    nom: row.nom,
    prefix,
    permissions: safeParseJson<string[]>(row.permissions, []),
    dateCreation: row.date_creation,
    dateExpiration: row.date_expiration ?? undefined,
    derniereUtilisation: row.derniere_utilisation ?? undefined,
  };
}

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function createApiKey(
  env: AppEnv['Bindings'],
  userId: number,
  input: CreateApiKeyInput
): Promise<CleApiCreee> {
  if (!input.nom || input.nom.trim().length === 0) {
    throw new HTTPException(400, { message: 'Key name is required' });
  }

  const { prefix, fullKey, hash: secretHash } = await generateApiKey();
  const storedKey = buildStoredKey(prefix, secretHash);

  const now = new Date().toISOString();
  const permissions = input.permissions ?? [];
  let dateExpiration: string | null = null;
  if (input.dateExpiration) {
    const parsed = new Date(input.dateExpiration);
    if (Number.isNaN(parsed.getTime())) {
      throw new HTTPException(400, { message: 'Invalid dateExpiration' });
    }
    if (parsed.getTime() <= Date.now()) {
      throw new HTTPException(400, { message: 'dateExpiration must be in the future' });
    }
    dateExpiration = parsed.toISOString();
  }

  const keyPublicId = crypto.randomUUID();
  const result = await d1Run(
    env,
    `INSERT INTO cles_api (public_id, id_utilisateur, nom, cle, permissions, date_creation, date_expiration, derniere_utilisation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    keyPublicId,
    userId,
    input.nom.trim(),
    storedKey,
    JSON.stringify(permissions),
    now,
    dateExpiration,
    null
  );

  const rowId = result.meta?.last_row_id ?? 0;
  if (!rowId) {
    throw new HTTPException(500, { message: 'Failed to create API key' });
  }

  return {
    id: keyPublicId,
    idUtilisateur: String(userId),
    nom: input.nom.trim(),
    cle: fullKey,
    prefix,
    permissions,
    dateCreation: now,
    dateExpiration: dateExpiration ?? undefined,
  };
}

export async function listApiKeys(
  env: AppEnv['Bindings'],
  userId: number
): Promise<CleApi[]> {
  const rows = await d1All<ApiKeyRow>(
    env,
    `SELECT id, public_id, id_utilisateur, nom, cle, permissions, date_creation, date_expiration, derniere_utilisation
     FROM cles_api
     WHERE id_utilisateur = ?
     ORDER BY date_creation DESC`,
    userId
  );
  return rows.map(toPublicApiKey);
}

export async function getApiKeyById(
  env: AppEnv['Bindings'],
  userId: number,
  publicId: string
): Promise<CleApi | null> {
  const row = await d1First<ApiKeyRow>(
    env,
    `SELECT id, public_id, id_utilisateur, nom, cle, permissions, date_creation, date_expiration, derniere_utilisation
     FROM cles_api
     WHERE public_id = ? AND id_utilisateur = ?`,
    publicId,
    userId
  );
  return row ? toPublicApiKey(row) : null;
}

export async function revokeApiKey(
  env: AppEnv['Bindings'],
  userId: number,
  publicId: string
): Promise<boolean> {
  const result = await d1Run(
    env,
    `DELETE FROM cles_api WHERE public_id = ? AND id_utilisateur = ?`,
    publicId,
    userId
  );
  const changes = (result.meta?.changes as number | undefined) ?? 0;
  return changes > 0;
}

interface ApiKeyLookupRow {
  id: number;
  id_utilisateur: number;
  cle: string;
  permissions: string;
  date_expiration: string | null;
  role: 'utilisateur' | 'admin';
  est_actif: number;
}

export async function verifyApiKey(
  env: AppEnv['Bindings'],
  key: string
): Promise<{ id: number; userId: number; role: 'utilisateur' | 'admin'; permissions: PermissionCleApi[] } | null> {
  const parsed = parseApiKey(key);
  if (!parsed) return null;

  const { prefix, secret } = parsed;
  const secretHash = await sha256(secret);
  const storedKey = buildStoredKey(prefix, secretHash);

  const row = await d1First<ApiKeyLookupRow>(
    env,
    `SELECT k.id, k.id_utilisateur, k.cle, k.permissions, k.date_expiration, u.role, u.est_actif
     FROM cles_api k
     JOIN utilisateurs u ON u.id = k.id_utilisateur
     WHERE k.cle = ?`,
    storedKey
  );
  if (!row) return null;

  if (row.est_actif !== 1) return null;

  if (row.date_expiration && new Date(row.date_expiration) < new Date()) {
    return null;
  }

  await d1Run(
    env,
    `UPDATE cles_api SET derniere_utilisation = ? WHERE id = ?`,
    new Date().toISOString(),
    row.id
  );

  const permissions = safeParseJson<PermissionCleApi[]>(row.permissions, []);
  return { id: row.id, userId: row.id_utilisateur, role: row.role, permissions };
}

export { KEY_PREFIX_LENGTH };
