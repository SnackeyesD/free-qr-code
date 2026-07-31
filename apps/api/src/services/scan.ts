import type { AppContext } from '../types/index.js';
import { d1First, d1All, d1Run } from '../lib/db.js';
import type { QRCodeDoc, ScanDoc, StatistiquesQRCodeDoc } from '../types/index.js';
import { detectTypeContenu } from '../lib/qr-generator.js';

type QRCodeRow = QRCodeDoc & { id: number };

type StatsRow = StatistiquesQRCodeDoc & { id: number };

export interface ClientInfo {
  ip: string;
  userAgent: string;
  referer?: string;
}

export function extractClientInfo(c: AppContext): ClientInfo {
  const rawIp =
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';
  return {
    ip: rawIp,
    userAgent: c.req.header('User-Agent') ?? 'unknown',
    referer: c.req.header('Referer') ?? undefined,
  };
}

export function anonymizeIp(ip: string): string {
  if (ip === 'unknown' || !ip.includes('.')) return ip;
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  return ip;
}

export function parseDeviceFamily(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    if (ua.includes('iphone')) return 'iPhone';
    if (ua.includes('ipad')) return 'iPad';
    if (ua.includes('android')) return 'Android';
    return 'Mobile';
  }
  if (ua.includes('tablet')) return 'Tablet';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'Mac';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('linux')) return 'Linux';
  return 'Desktop / Autre';
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (ip === 'unknown') return true;
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1] ?? '0', 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('::1') || ip.startsWith('fc00:') || ip.startsWith('fe80:')) return true;
  return false;
}

export interface GeoInfo {
  pays?: string;
  ville?: string;
}

export async function lookupGeo(ip: string): Promise<GeoInfo> {
  if (isPrivateOrReservedIp(ip)) {
    return {};
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'free-qr-code-saas/1.0' },
    });
    clearTimeout(timeout);
    if (!response.ok) return {};
    const data = (await response.json()) as Record<string, unknown>;
    if (data.error) return {};
    return {
      pays: typeof data.country_name === 'string' ? data.country_name : undefined,
      ville: typeof data.city === 'string' ? data.city : undefined,
    };
  } catch {
    return {};
  }
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function recordScan(
  env: AppContext['env'],
  qrCode: QRCodeRow,
  info: ClientInfo
): Promise<void> {
  const anonymizedIp = anonymizeIp(info.ip);
  const geo = await lookupGeo(info.ip);
  const now = new Date();
  const today = toISODate(startOfDay(now));
  const todayStart = `${today}T00:00:00.000Z`;
  const publicId = crypto.randomUUID();

  // Determiner l'unicite journaliere : aucun scan aujourd'hui depuis cette IP anonymisee.
  const existingToday = await d1First<ScanDoc>(
    env,
    `SELECT 1 FROM scans
     WHERE id_qrcode = ? AND adresse_ip = ? AND date_scan >= ?
     LIMIT 1`,
    qrCode.id,
    anonymizedIp,
    todayStart
  );
  const estUnique = existingToday === null;

  // Inserer le scan.
  await d1Run(
    env,
    `INSERT INTO scans (public_id, id_qrcode, adresse_ip, user_agent, pays, ville, referer, date_scan, est_unique)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    publicId,
    qrCode.id,
    anonymizedIp,
    info.userAgent,
    geo.pays ?? null,
    geo.ville ?? null,
    info.referer ?? null,
    now.toISOString(),
    estUnique ? 1 : 0
  );

  const deviceFamily = parseDeviceFamily(info.userAgent);

  // Upsert des statistiques journalieres avec JSON pour les top pays/appareils.
  const statsRow = await d1First<StatsRow>(
    env,
    `SELECT id, pays_top, appareils_top FROM statistiques_qrcodes
     WHERE id_qrcode = ? AND date = ?`,
    qrCode.id,
    today
  );

  const paysTop: Record<string, number> = safeParseJson(statsRow?.paysTop ?? '{}', 'pays_top');
  const appareilsTop: Record<string, number> = safeParseJson(
    statsRow?.appareilsTop ?? '{}',
    'appareils_top'
  );

  const paysKey = geo.pays ?? 'Inconnu';
  paysTop[paysKey] = (paysTop[paysKey] ?? 0) + 1;
  appareilsTop[deviceFamily] = (appareilsTop[deviceFamily] ?? 0) + 1;

  if (statsRow) {
    await d1Run(
      env,
      `UPDATE statistiques_qrcodes
       SET nombre_scans = nombre_scans + 1,
           nombre_scans_uniques = nombre_scans_uniques + ?,
           pays_top = ?,
           appareils_top = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      estUnique ? 1 : 0,
      JSON.stringify(paysTop),
      JSON.stringify(appareilsTop),
      statsRow.id
    );
  } else {
    await d1Run(
      env,
      `INSERT INTO statistiques_qrcodes (id_qrcode, date, nombre_scans, nombre_scans_uniques, pays_top, appareils_top)
       VALUES (?, ?, 1, ?, ?, ?)`,
      qrCode.id,
      today,
      estUnique ? 1 : 0,
      JSON.stringify(paysTop),
      JSON.stringify(appareilsTop)
    );
  }

  // Incrementer le compteur total du QR code.
  await d1Run(
    env,
    `UPDATE qrcodes SET nombre_scans_total = nombre_scans_total + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    qrCode.id
  );
}

function safeParseJson(value: unknown, fieldName: string): Record<string, number> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      const normalized: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        normalized[k] = typeof v === 'number' ? v : 0;
      }
      return normalized;
    } catch {
      return {};
    }
  }
  if (value && typeof value === 'object') {
    // D1 peut rendre un objet JSON natif selon les bindings.
    const normalized: Record<string, number> = {};
    for (const [k, v] of Object.entries(value)) {
      normalized[k] = typeof v === 'number' ? v : 0;
    }
    return normalized;
  }
  return {};
}

export async function resolveQrCodeByAlias(
  env: AppContext['env'],
  aliasCourt: string
): Promise<QRCodeRow | null> {
  return d1First<QRCodeRow>(
    env,
    `SELECT id, public_id, id_utilisateur, contenu, type_contenu AS typeContenu,
            est_dynamique AS estDynamique, alias_court AS aliasCourt, parametres,
            est_actif AS estActif, date_creation AS dateCreation, date_expiration AS dateExpiration,
            nombre_scans_total AS nombreScansTotal, url_image AS urlImage, id_modele AS idModele
     FROM qrcodes
     WHERE alias_court = ? AND est_dynamique = 1`,
    aliasCourt
  );
}

export interface StatsResult {
  idQrCode: string;
  periode: { from?: string; to?: string };
  totalScans: number;
  scansUniques: number;
  evolution: Array<{ date: string; scans: number; scansUniques: number }>;
  pays: Record<string, number>;
  appareils: Record<string, number>;
}

export async function getQrCodeStats(
  env: AppContext['env'],
  qrCodeId: number,
  from?: Date,
  to?: Date
): Promise<StatsResult> {
  const params: (string | number)[] = [qrCodeId];
  const dateConditions: string[] = [];

  if (from) {
    dateConditions.push('date >= ?');
    params.push(from.toISOString().slice(0, 10));
  }
  if (to) {
    dateConditions.push('date <= ?');
    params.push(to.toISOString().slice(0, 10));
  }

  const whereClause = dateConditions.length
    ? `WHERE id_qrcode = ? AND ${dateConditions.join(' AND ')}`
    : 'WHERE id_qrcode = ?';

  const stats = await d1All<StatistiquesQRCodeDoc>(
    env,
    `SELECT id, id_qrcode AS idQRCode, date, nombre_scans AS nombreScans,
            nombre_scans_uniques AS nombreScansUniques, pays_top AS paysTop, appareils_top AS appareilsTop
     FROM statistiques_qrcodes
     ${whereClause}
     ORDER BY date ASC`,
    ...params
  );

  const scanParams: (string | number)[] = [qrCodeId];
  const scanDateConditions: string[] = [];
  if (from) {
    scanDateConditions.push('date_scan >= ?');
    scanParams.push(from.toISOString());
  }
  if (to) {
    scanDateConditions.push('date_scan <= ?');
    scanParams.push(to.toISOString());
  }
  const scanWhere = scanDateConditions.length
    ? `WHERE id_qrcode = ? AND ${scanDateConditions.join(' AND ')}`
    : 'WHERE id_qrcode = ?';

  const scans = await d1All<ScanDoc>(
    env,
    `SELECT id, id_qrcode AS idQRCode, adresse_ip AS adresseIP, user_agent AS userAgent,
            pays, ville, referer, date_scan AS dateScan, est_unique AS estUnique
     FROM scans
     ${scanWhere}`,
    ...scanParams
  );

  const totalScans = stats.reduce((sum, s) => sum + (s.nombreScans ?? 0), 0);
  const scansUniques = stats.reduce((sum, s) => sum + (s.nombreScansUniques ?? 0), 0);

  const paysCount: Record<string, number> = {};
  const appareilsCount: Record<string, number> = {};

  for (const scan of scans) {
    const pays = scan.pays ?? 'Inconnu';
    paysCount[pays] = (paysCount[pays] ?? 0) + 1;
    const appareil = parseDeviceFamily(scan.userAgent ?? '');
    appareilsCount[appareil] = (appareilsCount[appareil] ?? 0) + 1;
  }

  const evolution = stats.map((s) => ({
    date: typeof s.date === 'string' ? s.date.slice(0, 10) : toISODate(new Date(s.date)),
    scans: s.nombreScans ?? 0,
    scansUniques: s.nombreScansUniques ?? 0,
  }));

  return {
    idQrCode: String(qrCodeId),
    periode: {
      from: from?.toISOString().slice(0, 10),
      to: to?.toISOString().slice(0, 10),
    },
    totalScans,
    scansUniques,
    evolution,
    pays: paysCount,
    appareils: appareilsCount,
  };
}

export { detectTypeContenu };
