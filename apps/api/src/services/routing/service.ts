// services/routing/service.ts
import { HTTPException } from "hono/http-exception";
import type {
  RoutingConfig,
  RoutingLimites,
  RoutingSimulationInput,
  RoutingSimulationResult,
  RoutingState,
} from "@free-qr/shared-types";
import type { AppEnv } from "../../types/index.js";
import { d1First, d1Run } from "../../lib/db.js";
import type { ContexteScan } from "../context.js";
import { estFuseauValide, FUSEAU_DEFAUT, parseConfigRoutage } from "./config.js";
import { resoudreVarianteDetaillee } from "./resolve.js";
import {
  chargerPlanUtilisateur,
  limitesRoutage,
  verifierLimites,
} from "./limits.js";

interface QRRow {
  id: number;
  contenu: string;
  est_dynamique: number;
  nombre_scans_total: number;
  regles_routage: string | null;
  fuseau: string | null;
}

async function chargerQr(
  env: AppEnv["Bindings"],
  userId: string,
  qrId: string,
): Promise<QRRow> {
  const id = Number(qrId);
  const idUtilisateur = Number(userId);
  if (!Number.isFinite(id) || !Number.isFinite(idUtilisateur)) {
    throw new HTTPException(400, { message: "Invalid QR code id" });
  }

  const row = await d1First<QRRow>(
    env,
    `SELECT id, contenu, est_dynamique, nombre_scans_total, regles_routage, fuseau
     FROM qrcodes
     WHERE id = ? AND id_utilisateur = ?`,
    id,
    idUtilisateur,
  );

  if (!row) {
    throw new HTTPException(404, { message: "QR code not found" });
  }
  return row;
}

function toState(row: QRRow, limites: RoutingLimites): RoutingState {
  return {
    reglesRoutage: parseConfigRoutage(row.regles_routage),
    fuseau: row.fuseau ?? FUSEAU_DEFAUT,
    estDynamique: row.est_dynamique === 1,
    contenu: row.contenu,
    limites,
  };
}

async function limitesDuCompte(
  env: AppEnv["Bindings"],
  userId: string,
): Promise<RoutingLimites> {
  const plan = await chargerPlanUtilisateur(env, userId);
  return limitesRoutage(env, plan);
}

export async function getRoutingState(
  env: AppEnv["Bindings"],
  userId: string,
  qrId: string,
): Promise<RoutingState> {
  const row = await chargerQr(env, userId, qrId);
  const limites = await limitesDuCompte(env, userId);
  return toState(row, limites);
}

export async function saveRoutingConfig(
  env: AppEnv["Bindings"],
  userId: string,
  qrId: string,
  config: RoutingConfig,
): Promise<RoutingState> {
  const row = await chargerQr(env, userId, qrId);
  const limites = await limitesDuCompte(env, userId);

  if (row.est_dynamique !== 1) {
    throw new HTTPException(400, {
      message: "Le routage contextuel nécessite un QR code dynamique",
    });
  }

  verifierLimites(config, limites);

  if (!estFuseauValide(config.fuseau)) {
    throw new HTTPException(400, {
      message: `Fuseau horaire invalide : ${config.fuseau}`,
    });
  }

  await d1Run(
    env,
    `UPDATE qrcodes
     SET regles_routage = ?, fuseau = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND id_utilisateur = ?`,
    JSON.stringify(config),
    config.fuseau,
    row.id,
    Number(userId),
  );

  return {
    reglesRoutage: config,
    fuseau: config.fuseau,
    estDynamique: true,
    contenu: row.contenu,
    limites,
  };
}

export async function deleteRoutingConfig(
  env: AppEnv["Bindings"],
  userId: string,
  qrId: string,
): Promise<RoutingState> {
  const row = await chargerQr(env, userId, qrId);
  const limites = await limitesDuCompte(env, userId);

  await d1Run(
    env,
    `UPDATE qrcodes
     SET regles_routage = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND id_utilisateur = ?`,
    row.id,
    Number(userId),
  );

  return {
    reglesRoutage: null,
    fuseau: row.fuseau ?? FUSEAU_DEFAUT,
    estDynamique: row.est_dynamique === 1,
    contenu: row.contenu,
    limites,
  };
}

export interface SimulationInput extends RoutingSimulationInput {
  /** Configuration non encore enregistrée (aperçu live dans l'éditeur). */
  config?: RoutingConfig;
}

export async function simulerRouting(
  env: AppEnv["Bindings"],
  userId: string,
  qrId: string,
  input: SimulationInput,
): Promise<RoutingSimulationResult> {
  const row = await chargerQr(env, userId, qrId);
  const config = input.config ?? parseConfigRoutage(row.regles_routage);

  if (!config) {
    throw new HTTPException(400, {
      message: "Aucune configuration de routage à simuler",
    });
  }

  const maintenant = input.date ? new Date(input.date) : new Date();

  const contexte: ContexteScan = {
    maintenant,
    pays: input.pays,
    ville: input.ville,
    langue: input.langue,
    appareil: input.appareil ?? "desktop",
    scansTotal: row.nombre_scans_total,
    scansAppareil: input.scansAppareil,
    consentementAppareil: input.scansAppareil !== undefined,
    graine: input.graine ?? "simulation",
  };

  const { resolution, etapes } = resoudreVarianteDetaillee(config, contexte);

  if (!resolution.variante) {
    throw new HTTPException(422, {
      message: `Simulation impossible : ${resolution.raison}`,
    });
  }

  return {
    varianteId: resolution.variante.id,
    libelle: resolution.variante.libelle,
    contenu: resolution.variante.contenu,
    regleId: resolution.regleId,
    raison: resolution.raison,
    contexte: {
      pays: contexte.pays,
      ville: contexte.ville,
      langue: contexte.langue,
      appareil: contexte.appareil,
      date: maintenant.toISOString(),
      scansTotal: contexte.scansTotal,
      scansAppareil: contexte.scansAppareil,
    },
    trace: etapes,
  };
}
