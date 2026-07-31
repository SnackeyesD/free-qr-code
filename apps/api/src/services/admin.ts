import { HTTPException } from 'hono/http-exception';
import { SignJWT, jwtVerify } from 'jose';
import type { AppEnv } from '../types/index.js';
import type { CibleCampagneEmail } from '@free-qr/shared-types';
import { d1All, d1First, d1Run, d1Insert } from '../lib/db.js';
import type { CampagneEmail, ModeleQR, TypeContenuQR } from '@free-qr/shared-types';

export interface CampagneEmailRow {
  id: number;
  public_id: string;
  id_utilisateur: number;
  titre: string;
  contenu: string;
  cible: string;
  statut: string;
  date_envoi: string | null;
  date_creation: string;
  nombre_ouvertures: number;
  nombre_clics: number;
}

export interface ModeleRow {
  id: number;
  public_id: string;
  id_utilisateur: number | null;
  nom: string;
  description: string | null;
  type_contenu: string;
  parametres_par_defaut: string;
  est_public: number;
  date_creation: string;
}

export interface MailerConfig {
  apiUrl?: string;
  from?: string;
}

export function getTrackingSecret(env: AppEnv['Bindings']): Uint8Array {
  return new TextEncoder().encode(env.JWT_TRACKING_SECRET);
}

export function getBaseUrl(env: AppEnv['Bindings']): string {
  return env.API_BASE_URL?.replace(/\/$/, '') ?? 'https://api.free-qrcode.app';
}

export function getMailerConfig(env: AppEnv['Bindings']): MailerConfig {
  return {
    apiUrl: env.SMTP_API_URL,
    from: env.SMTP_FROM ?? 'noreply@free-qrcode.app',
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

function toPublicCampaign(row: CampagneEmailRow): CampagneEmail {
  return {
    id: String(row.id),
    idUtilisateur: String(row.id_utilisateur),
    nom: row.titre ?? '',
    sujet: row.titre ?? '',
    contenu: row.contenu ?? '',
    corpsHtml: row.contenu ?? '',
    cible: row.cible as CibleCampagneEmail,
    statut: row.statut as CampagneEmail['statut'],
    dateEnvoi: row.date_envoi ?? undefined,
    dateCreation: row.date_creation,
    nombreOuvertures: row.nombre_ouvertures,
    nombreClics: row.nombre_clics,
  };
}

function toPublicTemplate(row: ModeleRow): ModeleQR {
  return {
    id: String(row.id),
    idUtilisateur: row.id_utilisateur ? String(row.id_utilisateur) : undefined,
    nom: row.nom,
    description: row.description ?? undefined,
    typeContenu: row.type_contenu as TypeContenuQR,
    parametresParDefaut: safeParseJson(row.parametres_par_defaut, {}),
    estPublic: row.est_public === 1,
    dateCreation: row.date_creation,
  };
}

export async function listCampaigns(env: AppEnv['Bindings']): Promise<{
  data: CampagneEmail[];
  total: number;
}> {
  const rows = await d1All<CampagneEmailRow>(
    env,
    `SELECT id, public_id, id_utilisateur, titre, contenu, cible, statut, date_envoi, date_creation,
            nombre_ouvertures, nombre_clics
     FROM campagnes_emails
     ORDER BY date_creation DESC
     LIMIT 100`
  );
  const countRow = await d1First<{ total: number }>(env, `SELECT COUNT(*) AS total FROM campagnes_emails`);
  return {
    data: rows.map(toPublicCampaign),
    total: countRow?.total ?? 0,
  };
}

export interface CreateCampaignInput {
  nom: string;
  sujet: string;
  corpsHtml: string;
  corpsTexte?: string;
  cible?: CibleCampagneEmail;
}

export interface UpdateCampaignInput {
  nom?: string;
  sujet?: string;
  corpsHtml?: string;
  corpsTexte?: string;
  cible?: CibleCampagneEmail;
}

export async function createCampaign(
  env: AppEnv['Bindings'],
  adminId: number,
  input: CreateCampaignInput
): Promise<CampagneEmail> {
  const now = new Date().toISOString();
  const id = await d1Insert(
    env,
    `INSERT INTO campagnes_emails (public_id, id_utilisateur, titre, contenu, cible, statut, date_creation, nombre_ouvertures, nombre_clics)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    adminId,
    input.sujet.trim(),
    input.corpsHtml,
    input.cible ?? 'tous',
    'brouillon',
    now,
    0,
    0
  );
  return toPublicCampaign({
    id,
    public_id: crypto.randomUUID(),
    id_utilisateur: adminId,
    titre: input.sujet.trim(),
    contenu: input.corpsHtml,
    cible: input.cible ?? 'tous',
    statut: 'brouillon',
    date_envoi: null,
    date_creation: now,
    nombre_ouvertures: 0,
    nombre_clics: 0,
  });
}

export async function getCampaignById(env: AppEnv['Bindings'], id: number): Promise<CampagneEmail> {
  const row = await d1First<CampagneEmailRow>(
    env,
    `SELECT id, public_id, id_utilisateur, titre, contenu, cible, statut, date_envoi, date_creation,
            nombre_ouvertures, nombre_clics
     FROM campagnes_emails
     WHERE id = ?`,
    id
  );
  if (!row) throw new HTTPException(404, { message: 'Campagne non trouvée' });
  return toPublicCampaign(row);
}

export async function updateCampaign(
  env: AppEnv['Bindings'],
  id: number,
  input: Partial<{
    nom: string;
    sujet: string;
    corpsHtml: string;
    corpsTexte?: string;
    cible: CibleCampagneEmail;
  }
>
): Promise<CampagneEmail> {
  const existing = await d1First<CampagneEmailRow>(
    env,
    `SELECT id, public_id, id_utilisateur, titre, contenu, cible, statut, date_envoi, date_creation,
            nombre_ouvertures, nombre_clics
     FROM campagnes_emails
     WHERE id = ?`,
    id
  );
  if (!existing) throw new HTTPException(404, { message: 'Campagne non trouvée' });
  if (existing.statut === 'envoyee') {
    throw new HTTPException(400, { message: 'Impossible de modifier une campagne déjà envoyée' });
  }

  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (input.sujet !== undefined) {
    sets.push('titre = ?');
    params.push(input.sujet.trim());
  }
  if (input.corpsHtml !== undefined) {
    sets.push('contenu = ?');
    params.push(input.corpsHtml);
  }
  if (input.cible !== undefined) {
    sets.push('cible = ?');
    params.push(input.cible);
  }

  if (sets.length > 0) {
    params.push(id);
    await d1Run(env, `UPDATE campagnes_emails SET ${sets.join(', ')} WHERE id = ?`, ...params);
  }

  return getCampaignById(env, id);
}

export async function buildRecipientSql(
  cible: CibleCampagneEmail
): Promise<{ where: string; params: (string | number)[] }> {
  switch (cible) {
    case 'consentants':
      return {
        where: `WHERE consentement_marketing = 1 AND est_actif = 1 AND est_verifie = 1`,
        params: [],
      };
    case 'tous':
      return {
        where: `WHERE est_actif = 1`,
        params: [],
      };
    case 'actifs':
      return {
        where: `WHERE est_actif = 1 AND est_verifie = 1 AND date_derniere_connexion >= ?`,
        params: [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()],
      };
    case 'inactifs':
      return {
        where: `WHERE est_actif = 1 AND est_verifie = 1 AND (date_derniere_connexion IS NULL OR date_derniere_connexion < ?)`,
        params: [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()],
      };
    case 'non_verifies':
      return {
        where: `WHERE est_verifie = 0`,
        params: [],
      };
    default:
      return { where: `WHERE est_actif = 1`, params: [] };
  }
}

export async function createTrackingToken(
  env: AppEnv['Bindings'],
  idCampagne: number,
  idUtilisateur: number
): Promise<string> {
  const secret = getTrackingSecret(env);
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ sub: String(idUtilisateur), cid: String(idCampagne) })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 24 * 60 * 60)
    .setAudience('free-qr-tracking')
    .setIssuer('free-qr-code-api')
    .sign(secret);
  return token;
}

export async function decodeTrackingToken(
  env: AppEnv['Bindings'],
  token: string
): Promise<{ userId: number; campaignId: number } | null> {
  try {
    const secret = getTrackingSecret(env);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      audience: 'free-qr-tracking',
      issuer: 'free-qr-code-api',
    });
    if (!payload.sub || !payload.cid) return null;
    return { userId: Number(payload.sub), campaignId: Number(payload.cid) };
  } catch {
    return null;
  }
}

function sanitizeHtmlForCampaign(html: string): string {
  const forbiddenTags = /<<script\b[^<]*(<\/script>|(?=<))/gi;
  const forbiddenEvents = /\bon\w+\s*=/gi;
  return html
    .replace(forbiddenTags, '')
    .replace(forbiddenEvents, 'data-disabled-event=')
    .replace(/javascript:/gi, 'disabled-script:');
}

function extractPlainTextFromHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function injectTrackingLinks(
  html: string,
  baseUrl: string,
  token: string,
  unsubscribeUrl: string
): string {
  const tracked = html.replace(
    /href\s*=\s*["'](https?:\/\/[^"']+)["']/gi,
    (match, url: string) =>
      `href="${baseUrl}/tracking/click?t=${encodeURIComponent(token)}\u0026u=${encodeURIComponent(url)}"`
  );
  const pixel = `<img src="${baseUrl}/tracking/pixel?t=${encodeURIComponent(token)}" width="1" height="1" alt="" style="display:block;" />`;
  const unsubscribe = `<p><a href="${unsubscribeUrl}">Se désinscrire</a></p>`;
  return tracked + pixel + unsubscribe;
}

export async function sendCampaign(
  env: AppEnv['Bindings'],
  id: number,
  scheduledAt?: Date
): Promise<{ sent: number; campaignId: number; status: string }> {
  const campaign = await d1First<CampagneEmailRow>(
    env,
    `SELECT id, id_utilisateur, titre, contenu, cible, statut FROM campagnes_emails WHERE id = ?`,
    id
  );
  if (!campaign) throw new HTTPException(404, { message: 'Campagne non trouvée' });
  if (campaign.statut === 'envoyee') {
    throw new HTTPException(400, { message: 'Campagne déjà envoyée' });
  }

  if (scheduledAt && scheduledAt > new Date()) {
    await d1Run(env, 'UPDATE campagnes_emails SET statut = ?, date_envoi = ? WHERE id = ?', 'programmee', scheduledAt.toISOString(), id);
    return { sent: 0, campaignId: id, status: 'programmee' };
  }

  const { where, params } = await buildRecipientSql(campaign.cible as CibleCampagneEmail);
  const recipients = await d1All<{ id: number; email: string; nom: string }>(
    env,
    `SELECT id, email, nom FROM utilisateurs ${where}`,
    ...params
  );

  const baseUrl = getBaseUrl(env);
  const cfg = getMailerConfig(env);
  let sent = 0;
  for (const recipient of recipients) {
    await d1Insert(
      env,
      `INSERT OR IGNORE INTO campagnes_utilisateurs (id_campagne, id_utilisateur, date_envoi_utilisateur)
       VALUES (?, ?, ?)`,
      id,
      recipient.id,
      new Date().toISOString()
    );
    const token = await createTrackingToken(env, id, recipient.id);
    const unsubscribeUrl = `${baseUrl}/unsubscribe?u=${recipient.id}`;
    const personalizedHtml = injectTrackingLinks(
      sanitizeHtmlForCampaign(campaign.contenu),
      baseUrl,
      token,
      unsubscribeUrl
    );
    const text = extractPlainTextFromHtml(campaign.contenu);
    await sendMailStub(cfg, { to: recipient.email, subject: campaign.titre, html: personalizedHtml, text });
    sent++;
  }

  await d1Run(
    env,
    'UPDATE campagnes_emails SET statut = ?, date_envoi = ?, nombre_ouvertures = ?, nombre_clics = ? WHERE id = ?',
    'envoyee',
    new Date().toISOString(),
    0,
    0,
    id
  );

  return { sent, campaignId: id, status: 'envoyee' };
}

export async function sendMailStub(
  cfg: MailerConfig,
  mail: { to: string; subject: string; html: string; text: string }
): Promise<void> {
  if (cfg.apiUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(cfg.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: cfg.from, ...mail }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err) {
      console.error('SMTP API send failed:', err);
    }
  } else {
    console.log(`[Email stub] To: ${mail.to}, Subject: ${mail.subject}`);
  }
}

export async function recordTrackingEvent(
  env: AppEnv['Bindings'],
  token: string,
  type: 'ouverture' | 'clic',
  extras: { urlCible?: string; userAgent?: string; ip?: string } = {}
): Promise<void> {
  const meta = await decodeTrackingToken(env, token);
  if (!meta) return;
  await d1Insert(
    env,
    `INSERT INTO tracking_emails (public_id, id_campagne, id_utilisateur, type, token_tracking, url_cible, user_agent, adresse_ip, date_evenement)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    meta.campaignId,
    meta.userId,
    type,
    token,
    extras.urlCible ?? null,
    extras.userAgent ?? null,
    extras.ip ?? null,
    new Date().toISOString()
  );

  const updateField = type === 'ouverture' ? 'est_ouvert' : 'est_clique';
  await d1Run(
    env,
    `UPDATE campagnes_utilisateurs
     SET ${updateField} = 1
     WHERE id_campagne = ? AND id_utilisateur = ?`,
    meta.campaignId,
    meta.userId
  );

  const incField = type === 'ouverture' ? 'nombre_ouvertures' : 'nombre_clics';
  await d1Run(env, `UPDATE campagnes_emails SET ${incField} = ${incField} + 1 WHERE id = ?`, meta.campaignId);
}

export function transparent1x1Gif(): ArrayBuffer {
  const base64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function listTemplates(env: AppEnv['Bindings']): Promise<{ data: ModeleQR[]; total: number }> {
  const rows = await d1All<ModeleRow>(
    env,
    `SELECT id, public_id, id_utilisateur, nom, description, type_contenu, parametres_par_defaut, est_public, date_creation
     FROM modeles
     ORDER BY date_creation DESC
     LIMIT 200`
  );
  const countRow = await d1First<{ total: number }>(env, `SELECT COUNT(*) AS total FROM modeles`);
  return { data: rows.map(toPublicTemplate), total: countRow?.total ?? 0 };
}

export interface CreateTemplateInput {
  nom: string;
  description?: string;
  typeContenu?: TypeContenuQR;
  parametresParDefaut?: Record<string, unknown>;
  estPublic?: boolean;
}

export async function createTemplate(
  env: AppEnv['Bindings'],
  adminId: number,
  input: CreateTemplateInput
): Promise<ModeleQR> {
  const now = new Date().toISOString();
  const id = await d1Insert(
    env,
    `INSERT INTO modeles (public_id, id_utilisateur, nom, description, type_contenu, parametres_par_defaut, est_public, date_creation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    adminId,
    input.nom.trim(),
    input.description ?? null,
    input.typeContenu ?? 'url',
    JSON.stringify(input.parametresParDefaut ?? {}),
    input.estPublic ? 1 : 0,
    now
  );
  return toPublicTemplate({
    id,
    public_id: crypto.randomUUID(),
    id_utilisateur: adminId,
    nom: input.nom.trim(),
    description: input.description ?? null,
    type_contenu: (input.typeContenu ?? 'url') as TypeContenuQR,
    parametres_par_defaut: JSON.stringify(input.parametresParDefaut ?? {}),
    est_public: input.estPublic ? 1 : 0,
    date_creation: now,
  });
}

export async function getTemplateById(env: AppEnv['Bindings'], id: number): Promise<ModeleQR> {
  const row = await d1First<ModeleRow>(
    env,
    `SELECT id, public_id, id_utilisateur, nom, description, type_contenu, parametres_par_defaut, est_public, date_creation
     FROM modeles
     WHERE id = ?`,
    id
  );
  if (!row) throw new HTTPException(404, { message: 'Modèle non trouvé' });
  return toPublicTemplate(row);
}

export async function updateTemplate(
  env: AppEnv['Bindings'],
  id: number,
  input: Partial<CreateTemplateInput>
): Promise<ModeleQR> {
  await getTemplateById(env, id);
  const sets: string[] = [];
  const params: (string | number | null)[] = [];
  if (input.nom !== undefined) {
    sets.push('nom = ?');
    params.push(input.nom.trim());
  }
  if (input.description !== undefined) {
    sets.push('description = ?');
    params.push(input.description);
  }
  if (input.typeContenu !== undefined) {
    sets.push('type_contenu = ?');
    params.push(input.typeContenu);
  }
  if (input.parametresParDefaut !== undefined) {
    sets.push('parametres_par_defaut = ?');
    params.push(JSON.stringify(input.parametresParDefaut));
  }
  if (input.estPublic !== undefined) {
    sets.push('est_public = ?');
    params.push(input.estPublic ? 1 : 0);
  }
  if (sets.length === 0) return getTemplateById(env, id);
  params.push(id);
  await d1Run(env, `UPDATE modeles SET ${sets.join(', ')} WHERE id = ?`, ...params);
  return getTemplateById(env, id);
}

export async function deleteTemplate(env: AppEnv['Bindings'], id: number): Promise<void> {
  const result = await d1Run(env, 'DELETE FROM modeles WHERE id = ?', id);
  const changes = (result.meta?.changes as number | undefined) ?? 0;
  if (changes === 0) throw new HTTPException(404, { message: 'Modèle non trouvé' });
}
