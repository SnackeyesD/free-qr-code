import { HTTPException } from 'hono/http-exception';
import { d1First, d1All, d1Run, d1Insert } from '../lib/db.js';
import type { AppEnv } from '../types/index.js';
import type { JournalQRCodeRow } from '../lib/d1.js';
import type { ActionJournalQRCode } from '@free-qr/shared-types';

export interface CreateLogInput {
  idQRCode: number;
  idUtilisateur: number;
  action: ActionJournalQRCode;
  ancienneValeur?: Record<string, unknown>;
  nouvelleValeur?: Record<string, unknown>;
}

export interface QRCodeLog {
  id: number;
  publicId: string;
  idQRCode: number;
  idUtilisateur: number;
  action: ActionJournalQRCode;
  ancienneValeur?: Record<string, unknown>;
  nouvelleValeur?: Record<string, unknown>;
  date: string;
}

function safeParseJson<T extends Record<string, unknown>>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function toPublicLog(row: JournalQRCodeRow): QRCodeLog {
  return {
    id: row.id,
    publicId: row.public_id,
    idQRCode: row.id_qrcode,
    idUtilisateur: row.id_utilisateur,
    action: row.action,
    ancienneValeur: safeParseJson(row.ancienne_valeur),
    nouvelleValeur: safeParseJson(row.nouvelle_valeur),
    date: row.date,
  };
}

export async function createQRCodeLog(
  env: AppEnv['Bindings'],
  input: CreateLogInput
): Promise<QRCodeLog> {
  const now = new Date().toISOString();
  const publicId = crypto.randomUUID();

  const id = await d1Insert(
    env,
    `INSERT INTO journaux_qrcodes (public_id, id_qrcode, id_utilisateur, action, ancienne_valeur, nouvelle_valeur, date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    publicId,
    input.idQRCode,
    input.idUtilisateur,
    input.action,
    input.ancienneValeur ? JSON.stringify(input.ancienneValeur) : null,
    input.nouvelleValeur ? JSON.stringify(input.nouvelleValeur) : null,
    now
  );

  return {
    id,
    publicId,
    idQRCode: input.idQRCode,
    idUtilisateur: input.idUtilisateur,
    action: input.action,
    ancienneValeur: input.ancienneValeur,
    nouvelleValeur: input.nouvelleValeur,
    date: now,
  };
}

export async function listQRCodeLogs(
  env: AppEnv['Bindings'],
  idQRCode: number,
  options: { limit?: number; offset?: number } = {}
): Promise<{ data: QRCodeLog[]; total: number }> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const offset = Math.max(0, options.offset ?? 0);

  const rows = await d1All<JournalQRCodeRow>(
    env,
    `SELECT id, public_id, id_qrcode, id_utilisateur, action, ancienne_valeur, nouvelle_valeur, date
     FROM journaux_qrcodes
     WHERE id_qrcode = ?
     ORDER BY date DESC
     LIMIT ? OFFSET ?`,
    idQRCode,
    limit,
    offset
  );

  const countRow = await d1First<{ total: number }>(
    env,
    `SELECT COUNT(*) AS total FROM journaux_qrcodes WHERE id_qrcode = ?`,
    idQRCode
  );

  return {
    data: rows.map(toPublicLog),
    total: countRow?.total ?? 0,
  };
}

export async function getLogById(
  env: AppEnv['Bindings'],
  id: number
): Promise<QRCodeLog | null> {
  const row = await d1First<JournalQRCodeRow>(
    env,
    `SELECT id, public_id, id_qrcode, id_utilisateur, action, ancienne_valeur, nouvelle_valeur, date
     FROM journaux_qrcodes
     WHERE id = ?`,
    id
  );
  return row ? toPublicLog(row) : null;
}

export async function assertQRCodeOwner(
  env: AppEnv['Bindings'],
  idQRCode: number,
  userId: number
): Promise<void> {
  const row = await d1First<{ id: number }>(
    env,
    `SELECT id FROM qrcodes WHERE id = ? AND id_utilisateur = ?`,
    idQRCode,
    userId
  );
  if (!row) {
    throw new HTTPException(403, { message: 'Access denied to this QR code' });
  }
}

export async function logQRCodeAction(
  env: AppEnv['Bindings'],
  input: {
    idQRCode: number;
    idUtilisateur: number;
    action: ActionJournalQRCode;
    ancienneValeur?: Record<string, unknown>;
    nouvelleValeur?: Record<string, unknown>;
  }
): Promise<void> {
  await createQRCodeLog(env, input);
}

export { d1First, d1All, d1Run, d1Insert };
