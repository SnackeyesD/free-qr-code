import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../types/index.js";
import { d1All, d1First } from "../lib/db.js";

const SEVEN_DAYS_AGO = "datetime('now', '-7 days')";

function getUserInternalId(
  env: AppEnv["Bindings"],
  userId: string,
): Promise<{ id: number } | null> {
  return d1First<{ id: number }>(
    env,
    `SELECT public_id FROM utilisateurs WHERE id = ?`,
    userId,
  );
}

export interface UserDashboardStats {
  totalQRCodes: number;
  scans7j: number;
  scansUniques7j: number;
  totalScans: number;
  topQRcodes: Array<{
    id: number;
    nom: string;
    scansTotal: number;
    aliasCourt: string | null;
  }>;
  recentQRCodes: Array<{
    id: number;
    nom: string;
    typeContenu: string;
    dateCreation: string;
    estActif: boolean;
  }>;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalQRCodes: number;
  totalScans7j: number;
  totalScans: number;
  topUsers: Array<{
    id: string;
    nom: string;
    email: string;
    qrCount: number;
    scanCount: number;
  }>;
  recentScans: Array<{
    dateScan: string;
    pays: string | null;
    appareil: string | null;
    aliasCourt: string | null;
  }>;
}

export async function getUserDashboardStats(
  env: AppEnv["Bindings"],
  userId: string,
): Promise<UserDashboardStats> {
  const idUtilisateur = Number(userId);
  if (!Number.isFinite(idUtilisateur)) {
    throw new HTTPException(400, { message: "Invalid user id" });
  }

  const totalQRCodesRow = await d1First<{ total: number }>(
    env,
    `SELECT COUNT(*) AS total FROM qrcodes WHERE id_utilisateur = ?`,
    idUtilisateur,
  );

  const scans7jRow = await d1First<{ total: number }>(
    env,
    `SELECT COALESCE(SUM(nombre_scans), 0) AS total
     FROM statistiques_qrcodes
     WHERE id_qrcode IN (SELECT id FROM qrcodes WHERE id_utilisateur = ?)
       AND date >= date('now', '-7 days')`,
    idUtilisateur,
  );

  const scansUniques7jRow = await d1First<{ total: number }>(
    env,
    `SELECT COALESCE(SUM(nombre_scans_uniques), 0) AS total
     FROM statistiques_qrcodes
     WHERE id_qrcode IN (SELECT id FROM qrcodes WHERE id_utilisateur = ?)
       AND date >= date('now', '-7 days')`,
    idUtilisateur,
  );

  const totalScansRow = await d1First<{ total: number }>(
    env,
    `SELECT COALESCE(SUM(nombre_scans_total), 0) AS total
     FROM qrcodes
     WHERE id_utilisateur = ?`,
    idUtilisateur,
  );

  const topQRCodes = await d1All<{
    id: number;
    nom: string;
    scansTotal: number;
    aliasCourt: string | null;
    estDynamique: number;
    dateCreation: string;
  }>(
    env,
    `SELECT q.id, q.contenu AS nom, q.nombre_scans_total AS scansTotal, q.alias_court AS aliasCourt,
    q.est_dynamique AS estDynamique, q.date_creation AS dateCreation
     FROM qrcodes q
     WHERE q.id_utilisateur = ?
     ORDER BY q.nombre_scans_total DESC
     LIMIT 5`,
    idUtilisateur,
  );

  const recentQRCodes = await d1All<{
    id: number;
    nom: string;
    typeContenu: string;
    dateCreation: string;
    estActif: number;
    estDynamique: number;
  }>(
    env,
    `SELECT q.id, q.contenu AS nom, q.type_contenu AS typeContenu, q.date_creation AS dateCreation, q.est_actif AS estActif, q.est_dynamique AS estDynamique
     FROM qrcodes q
     WHERE q.id_utilisateur = ?
     ORDER BY q.date_creation DESC
     LIMIT 5`,
    idUtilisateur,
  );

  return {
    totalQRCodes: totalQRCodesRow?.total ?? 0,
    scans7j: scans7jRow?.total ?? 0,
    scansUniques7j: scansUniques7jRow?.total ?? 0,
    totalScans: totalScansRow?.total ?? 0,
    topQRcodes: topQRCodes.map((qr) => ({ ...qr, estDynamique: qr.estDynamique === 1 })),
    recentQRCodes: recentQRCodes.map((qr) => ({
      ...qr,
      estActif: qr.estActif === 1,
      estDynamique: qr.estDynamique === 1,
    })),
  };
}

export async function getAdminDashboardStats(
  env: AppEnv["Bindings"],
): Promise<AdminDashboardStats> {
  const totalUsersRow = await d1First<{ total: number }>(
    env,
    `SELECT COUNT(*) AS total FROM utilisateurs`,
  );

  const totalQRCodesRow = await d1First<{ total: number }>(
    env,
    `SELECT COUNT(*) AS total FROM qrcodes`,
  );

  const totalScans7jRow = await d1First<{ total: number }>(
    env,
    `SELECT COUNT(*) AS total
     FROM scans
     WHERE date_scan >= ${SEVEN_DAYS_AGO}`,
  );

  const totalScansRow = await d1First<{ total: number }>(
    env,
    `SELECT COUNT(*) AS total FROM scans`,
  );

  const topUsers = await d1All<{
    id: number;
    nom: string;
    email: string;
    qrCount: number;
    scanCount: number;
  }>(
    env,
    `SELECT u.id, u.nom, u.email,
            COUNT(DISTINCT q.id) AS qrCount,
            COALESCE(SUM(q.nombre_scans_total), 0) AS scanCount
     FROM utilisateurs u
     LEFT JOIN qrcodes q ON q.id_utilisateur = u.id
     GROUP BY u.id, u.nom, u.email
     ORDER BY scanCount DESC
     LIMIT 5`,
  );

  const recentScans = await d1All<{
    dateScan: string;
    pays: string | null;
    appareil: string | null;
    aliasCourt: string | null;
  }>(
    env,
    `SELECT s.date_scan AS dateScan, s.pays, s.user_agent AS appareil, q.alias_court AS aliasCourt
     FROM scans s
     LEFT JOIN qrcodes q ON q.id = s.id_qrcode
     ORDER BY s.date_scan DESC
     LIMIT 10`,
  );

  return {
    totalUsers: totalUsersRow?.total ?? 0,
    totalQRCodes: totalQRCodesRow?.total ?? 0,
    totalScans7j: totalScans7jRow?.total ?? 0,
    totalScans: totalScansRow?.total ?? 0,
    topUsers: topUsers.map((u) => ({
      id: String(u.id),
      nom: u.nom,
      email: u.email,
      qrCount: u.qrCount,
      scanCount: u.scanCount,
    })),
    recentScans,
  };
}
