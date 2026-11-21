// services/routing/metrics.ts
// Instrumentation de la monetisation (phase 5).
//
// Sans mesure, la decision de basculer `ROUTING_PRO_ONLY` se prendrait a
// l'aveugle. On compte donc : adoption du routage, usage reel (>= 2 variantes),
// potentiel de conversion (comptes distincts) et interet pour les stats.
//
// Aucune donnee personnelle : que des comptages et des ids internes agreges.
import type { RoutingMetrics } from "@free-qr/shared-types";
import type { AppEnv } from "../../types/index.js";
import { d1All, d1First, d1Run } from "../../lib/db.js";
import { parseConfigRoutage } from "./config.js";

interface LigneRoutage {
  id_utilisateur: number;
  regles_routage: string | null;
}

interface LigneCompte {
  total: number;
}

/**
 * Enregistre une consultation de l'ecran de stats par variante.
 * Appele en `waitUntil` : ne bloque jamais la reponse.
 */
export async function enregistrerConsultationStats(
  env: AppEnv["Bindings"],
  userId: string,
  dateISO = new Date().toISOString(),
): Promise<void> {
  const idUtilisateur = Number(userId);
  if (!Number.isFinite(idUtilisateur)) return;

  try {
    await d1Run(
      env,
      `INSERT INTO routage_consultations_stats (id_utilisateur, date_consultation)
       VALUES (?, ?)`,
      idUtilisateur,
      dateISO,
    );
  } catch (err) {
    // Une mesure d'adoption ne doit jamais faire échouer une lecture de stats.
    console.error(
      "Routage: echec d'enregistrement de la consultation stats",
      err,
    );
  }
}

/** Metriques admin. Lecture seule, uniquement sur les routes `/admin`. */
export async function getRoutingMetrics(
  env: AppEnv["Bindings"],
  maintenant = new Date(),
): Promise<RoutingMetrics> {
  const lignes = await d1All<LigneRoutage>(
    env,
    `SELECT id_utilisateur, regles_routage
     FROM qrcodes
     WHERE regles_routage IS NOT NULL AND length(regles_routage) > 0`,
  );

  const comptes = new Set<number>();
  let qrAvecRoutage = 0;
  let qrMultiVariantes = 0;

  for (const ligne of lignes) {
    // Parsing tolerant : une ligne corrompue ne doit pas faire echouer l'admin.
    const config = parseConfigRoutage(ligne.regles_routage);
    if (!config) continue;

    qrAvecRoutage += 1;
    comptes.add(Number(ligne.id_utilisateur));
    if (config.variantes.length >= 2) qrMultiVariantes += 1;
  }

  const qrTotal = await d1First<LigneCompte>(
    env,
    `SELECT COUNT(*) AS total FROM qrcodes`,
  );

  const consultationsTotal = await d1First<LigneCompte>(
    env,
    `SELECT COUNT(*) AS total FROM routage_consultations_stats`,
  );

  const debutTrenteJours = new Date(
    maintenant.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const consultationsTrenteJours = await d1First<LigneCompte>(
    env,
    `SELECT COUNT(*) AS total FROM routage_consultations_stats
     WHERE date_consultation >= ?`,
    debutTrenteJours,
  );

  const consultationsComptes = await d1First<LigneCompte>(
    env,
    `SELECT COUNT(DISTINCT id_utilisateur) AS total
     FROM routage_consultations_stats`,
  );

  const plans = await d1All<{ plan: string; total: number }>(
    env,
    `SELECT plan, COUNT(*) AS total FROM utilisateurs GROUP BY plan`,
  );

  const planGratuit = plans.find((ligne) => ligne.plan === "gratuit");
  const planPro = plans.find((ligne) => ligne.plan === "pro");

  return {
    proOnly: env.ROUTING_PRO_ONLY === "true",
    qrTotal: Number(qrTotal?.total ?? 0),
    qrAvecRoutage,
    qrMultiVariantes,
    comptesRoutage: comptes.size,
    consultationsStats: {
      total: Number(consultationsTotal?.total ?? 0),
      trenteJours: Number(consultationsTrenteJours?.total ?? 0),
      comptes: Number(consultationsComptes?.total ?? 0),
    },
    plans: {
      gratuit: Number(planGratuit?.total ?? 0),
      pro: Number(planPro?.total ?? 0),
    },
    genereLe: maintenant.toISOString(),
  };
}
