import type { AppEnv, QRCodeDoc, TypeContenuQR } from '../types/index.js';
import { d1First, d1All, d1Run, d1Insert, type D1BindValue } from '../lib/db.js';
import { generateQRCodeImage, detectTypeContenu, encodeQRContent } from '../lib/qr-generator.js';
import { uploadQRImage, buildQRImageKey, getPublicR2Url, deleteQRImage } from '../lib/r2.js';
import type { CreateQRCodeInput, UpdateQRCodeInput, ListQRCodeInput } from '../validators/qrcode.js';
import type { QRCode as QRCodeType } from '@free-qr/shared-types';
import { HTTPException } from 'hono/http-exception';

export interface QRCodeRow {
  id: number;
  public_id: string;
  id_utilisateur: number;
  id_modele: number | null;
  contenu: string;
  type_contenu: TypeContenuQR;
  est_dynamique: number;
  alias_court: string | null;
  parametres: string;
  est_actif: number;
  date_creation: string;
  date_expiration: string | null;
  nombre_scans_total: number;
  url_image: string | null;
}

const ALPHANUM = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateShortAlias(length = 7): string {
  let alias = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    alias += ALPHANUM[bytes[i] % ALPHANUM.length];
  }
  return alias;
}

function parseParameters(parametres: string | null): QRCodeType['parametres'] {
  try {
    return parametres ? (JSON.parse(parametres) as QRCodeType['parametres']) : {};
  } catch {
    return {};
  }
}

function toPublicQR(row: QRCodeRow): QRCodeType {
  return {
    id: String(row.id),
    idUtilisateur: String(row.id_utilisateur),
    contenu: row.contenu,
    typeContenu: row.type_contenu,
    estDynamique: row.est_dynamique === 1,
    aliasCourt: row.alias_court ?? undefined,
    parametres: parseParameters(row.parametres),
    estActif: row.est_actif === 1,
    dateCreation: row.date_creation,
    dateExpiration: row.date_expiration ?? undefined,
    nombreScansTotal: row.nombre_scans_total,
    urlImage: row.url_image ?? undefined,
    idModele: row.id_modele ? String(row.id_modele) : undefined,
  };
}

async function ensureUniqueAlias(env: AppEnv['Bindings'], length = 7, maxAttempts = 10): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const alias = generateShortAlias(length);
    const existing = await d1First<{ id: number }>(env, 'SELECT id FROM qrcodes WHERE alias_court = ?', alias);
    if (!existing) return alias;
  }
  throw new HTTPException(500, { message: 'Unable to generate unique short alias' });
}

export async function createQRCode(
  env: AppEnv['Bindings'],
  userId: string,
  input: CreateQRCodeInput,
): Promise<QRCodeType> {
  const idUtilisateur = Number(userId);
  if (!Number.isFinite(idUtilisateur)) {
    throw new HTTPException(400, { message: 'Invalid user id' });
  }

  const now = new Date().toISOString();
  const typeContenu = (input.typeContenu as TypeContenuQR | undefined) || (detectTypeContenu(input.contenu) as TypeContenuQR);
  const encodedContent = input.typeContenu ? encodeQRContent(input.typeContenu, input.contenu) : input.contenu;
  const isDynamic = input.type === 'dynamique';

  const parametres: QRCodeType['parametres'] = {
    taille: 512,
    correction: 'M',
    cadre: true,
    ...input.design,
  };

  const aliasCourt = isDynamic ? await ensureUniqueAlias(env) : null;
  const baseUrl = env.API_BASE_URL?.replace(/\/$/, '') ?? 'https://api.free-qrcode.app';
  const qrContent = isDynamic && aliasCourt ? `${baseUrl}/q/${aliasCourt}` : encodedContent;

  const publicId = crypto.randomUUID();
  const idModele = input.design?.idModele ? Number(input.design.idModele) : null;

  const qrId = await d1Insert(
    env,
    `INSERT INTO qrcodes (
      public_id, id_utilisateur, id_modele, contenu, type_contenu, est_dynamique,
      alias_court, parametres, est_actif, date_creation, nombre_scans_total, url_image
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    publicId,
    idUtilisateur,
    idModele,
    encodedContent,
    typeContenu,
    isDynamic ? 1 : 0,
    aliasCourt,
    JSON.stringify(parametres),
    1,
    now,
    0,
    null,
  );

  if (!qrId) {
    throw new HTTPException(500, { message: 'Failed to create QR code' });
  }

  const { buffer, mimeType, extension } = await generateQRCodeImage(qrContent, parametres);
  const key = buildQRImageKey(userId, String(qrId), extension);
  let urlImage: string | undefined;

  if (env.QR_IMAGES) {
    await uploadQRImage(env.QR_IMAGES, key, buffer, mimeType);
    urlImage = getPublicR2Url(env, key);
    await d1Run(env, 'UPDATE qrcodes SET url_image = ? WHERE id = ?', urlImage, qrId);
  }

  return toPublicQR({
    id: qrId,
    public_id: publicId,
    id_utilisateur: idUtilisateur,
    id_modele: idModele,
    contenu: encodedContent,
    type_contenu: typeContenu,
    est_dynamique: isDynamic ? 1 : 0,
    alias_court: aliasCourt,
    parametres: JSON.stringify(parametres),
    est_actif: 1,
    date_creation: now,
    date_expiration: null,
    nombre_scans_total: 0,
    url_image: urlImage ?? null,
  });
}

export async function listQRCodes(
  env: AppEnv['Bindings'],
  userId: string,
  query: ListQRCodeInput,
): Promise<{ data: QRCodeType[]; total: number; page: number; limit: number; hasNext: boolean }> {
  const idUtilisateur = Number(userId);
  if (!Number.isFinite(idUtilisateur)) {
    throw new HTTPException(400, { message: 'Invalid user id' });
  }

  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  const conditions: string[] = ['id_utilisateur = ?'];
  const params: D1BindValue[] = [idUtilisateur];

  if (query.type) {
    conditions.push('est_dynamique = ?');
    params.push(query.type === 'dynamique' ? 1 : 0);
  }

  if (query.search) {
    const search = `%${query.search.trim()}%`;
    conditions.push('(contenu LIKE ? OR alias_court LIKE ?)');
    params.push(search, search);
  }

  const whereClause = conditions.join(' AND ');
  const countParams = [...params];

  const totalRow = await d1First<{ total: number }>(env, `SELECT COUNT(*) as total FROM qrcodes WHERE ${whereClause}`, ...countParams);
  const total = totalRow?.total ?? 0;

  const rows = await d1All<QRCodeRow>(
    env,
    `SELECT * FROM qrcodes WHERE ${whereClause} ORDER BY date_creation DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  return {
    data: rows.map(toPublicQR),
    total,
    page,
    limit,
    hasNext: offset + rows.length < total,
  };
}

export async function getQRCodeById(
  env: AppEnv['Bindings'],
  userId: string,
  qrId: string,
): Promise<QRCodeType> {
  const id = Number(qrId);
  const idUtilisateur = Number(userId);
  if (!Number.isFinite(id) || !Number.isFinite(idUtilisateur)) {
    throw new HTTPException(400, { message: 'Invalid QR code id' });
  }

  const row = await d1First<QRCodeRow>(
    env,
    'SELECT * FROM qrcodes WHERE id = ? AND id_utilisateur = ?',
    id,
    idUtilisateur,
  );
  if (!row) {
    throw new HTTPException(404, { message: 'QR code not found' });
  }
  return toPublicQR(row);
}

export async function getQRCodeByPublicId(
  env: AppEnv['Bindings'],
  userId: string,
  publicId: string,
): Promise<QRCodeType> {
  const idUtilisateur = Number(userId);
  if (!Number.isFinite(idUtilisateur)) {
    throw new HTTPException(400, { message: 'Invalid user id' });
  }

  const row = await d1First<QRCodeRow>(
    env,
    'SELECT * FROM qrcodes WHERE public_id = ? AND id_utilisateur = ?',
    publicId,
    idUtilisateur,
  );
  if (!row) {
    throw new HTTPException(404, { message: 'QR code not found' });
  }
  return toPublicQR(row);
}

export async function updateQRCode(
  env: AppEnv['Bindings'],
  userId: string,
  qrId: string,
  input: UpdateQRCodeInput,
): Promise<QRCodeType> {
  const id = Number(qrId);
  const idUtilisateur = Number(userId);
  if (!Number.isFinite(id) || !Number.isFinite(idUtilisateur)) {
    throw new HTTPException(400, { message: 'Invalid QR code id' });
  }

  const existing = await d1First<QRCodeRow>(
    env,
    'SELECT * FROM qrcodes WHERE id = ? AND id_utilisateur = ?',
    id,
    idUtilisateur,
  );
  if (!existing) {
    throw new HTTPException(404, { message: 'QR code not found' });
  }

  const updates: Partial<QRCodeRow> = {};
  const updateFields: string[] = [];
  const updateParams: D1BindValue[] = [];

  if (input.contenu !== undefined) {
    if (existing.est_dynamique === 1) {
      updates.type_contenu = detectTypeContenu(input.contenu) as TypeContenuQR;
      updates.contenu = encodeQRContent(updates.type_contenu, input.contenu);
    } else {
      updates.contenu = input.contenu;
    }
  }
  if (input.estActif !== undefined) updates.est_actif = input.estActif ? 1 : 0;
  if (input.parametres) {
    const merged = { ...parseParameters(existing.parametres), ...input.parametres };
    updates.parametres = JSON.stringify(merged);
  }

  if (Object.keys(updates).length === 0) {
    return toPublicQR(existing);
  }

  for (const [key, value] of Object.entries(updates)) {
    updateFields.push(`${key} = ?`);
    updateParams.push(value as D1BindValue);
  }
  updateParams.push(id);

  await d1Run(env, `UPDATE qrcodes SET ${updateFields.join(', ')} WHERE id = ?`, ...updateParams);

  const updated: QRCodeRow = { ...existing, ...updates };

  // Regenerate QR image if dynamic content changed or design changed
  if ((existing.est_dynamique === 1 && input.contenu !== undefined) || input.parametres) {
    const baseUrl = env.API_BASE_URL?.replace(/\/$/, '') ?? 'https://api.free-qrcode.app';
    const qrContent = existing.est_dynamique === 1 && existing.alias_court
      ? `${baseUrl}/q/${existing.alias_court}`
      : updated.contenu;
    const parametres = parseParameters(updated.parametres);
    const { buffer, mimeType, extension } = await generateQRCodeImage(qrContent, parametres);
    const key = buildQRImageKey(userId, qrId, extension);
    if (env.QR_IMAGES) {
      await uploadQRImage(env.QR_IMAGES, key, buffer, mimeType);
      updated.url_image = getPublicR2Url(env, key);
      await d1Run(env, 'UPDATE qrcodes SET url_image = ? WHERE id = ?', updated.url_image, id);
    }
  }

  return toPublicQR(updated);
}

export async function deleteQRCode(
  env: AppEnv['Bindings'],
  userId: string,
  qrId: string,
): Promise<void> {
  const id = Number(qrId);
  const idUtilisateur = Number(userId);
  if (!Number.isFinite(id) || !Number.isFinite(idUtilisateur)) {
    throw new HTTPException(400, { message: 'Invalid QR code id' });
  }

  const row = await d1First<QRCodeRow>(
    env,
    'SELECT * FROM qrcodes WHERE id = ? AND id_utilisateur = ?',
    id,
    idUtilisateur,
  );
  if (!row) {
    throw new HTTPException(404, { message: 'QR code not found' });
  }

  await d1Run(env, 'DELETE FROM qrcodes WHERE id = ?', id);

  if (row.url_image && env.QR_IMAGES) {
    const parametres = parseParameters(row.parametres);
    const key = buildQRImageKey(userId, qrId, parametres.formatImage === 'svg' ? 'svg' : 'png');
    await deleteQRImage(env.QR_IMAGES, key).catch(() => undefined);
  }
}

export async function resolveQRByAlias(
  env: AppEnv['Bindings'],
  alias: string,
): Promise<QRCodeType> {
  const row = await d1First<QRCodeRow>(
    env,
    'SELECT * FROM qrcodes WHERE alias_court = ? AND est_dynamique = 1',
    alias,
  );
  if (!row) {
    throw new HTTPException(404, { message: 'QR code not found or inactive' });
  }
  if (row.est_actif !== 1) {
    throw new HTTPException(404, { message: 'QR code not found or inactive' });
  }
  return toPublicQR(row);
}

export { toPublicQR };
