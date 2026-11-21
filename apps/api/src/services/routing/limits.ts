// services/routing/limits.ts
// Couture de monetisation (phase 5) : un flag, des quotas, aucun paywall.
//
// Regle d'or : on bloque la CREATION / MODIFICATION, jamais le runtime.
// `/q/:alias` ne lit jamais le plan : un QR deja imprime doit continuer a
// fonctionner meme si l'abonnement expire.
import type { PlanUtilisateur, RoutingConfig, RoutingLimites } from "@free-qr/shared-types";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../../types/index.js";
import { d1First } from "../../lib/db.js";

function entierPositif(valeur: string | undefined, defaut: number): number {
  const nombre = Number.parseInt(valeur ?? "", 10);
  return Number.isFinite(nombre) && nombre >= 0 ? nombre : defaut;
}

/**
 * Tant que `ROUTING_PRO_ONLY` n'est pas "true", tout le monde est illimite.
 * Le jour de la bascule, les comptes gratuits ne peuvent plus editer de routage.
 */
export function limitesRoutage(
  env: AppEnv["Bindings"],
  plan: PlanUtilisateur,
): RoutingLimites {
  const proOnly = env.ROUTING_PRO_ONLY === "true";

  if (!proOnly || plan === "pro") {
    return { plan, proOnly, autorise: true, variantes: null, regles: null };
  }

  return {
    plan,
    proOnly,
    autorise: false,
    variantes: entierPositif(env.ROUTING_LIMITE_VARIANTES, 1),
    regles: entierPositif(env.ROUTING_LIMITE_REGLES, 0),
  };
}

/** Lit le plan d'un compte. Appele uniquement sur les routes d'edition. */
export async function chargerPlanUtilisateur(
  env: AppEnv["Bindings"],
  userId: string,
): Promise<PlanUtilisateur> {
  const row = await d1First<{ plan: string | null }>(
    env,
    `SELECT plan FROM utilisateurs WHERE id = ?`,
    Number(userId),
  );
  return row?.plan === "pro" ? "pro" : "gratuit";
}

/**
 * Applique les limites a une configuration candidate.
 * 402 = fonctionnalite reservee a un plan ; 400 = quota depasse.
 */
export function verifierLimites(
  config: RoutingConfig,
  limites: RoutingLimites,
): void {
  if (!limites.autorise) {
    throw new HTTPException(402, {
      message:
        "Le routage contextuel est réservé au plan Pro. Les configurations existantes continuent de fonctionner.",
    });
  }

  if (limites.variantes !== null && config.variantes.length > limites.variantes) {
    throw new HTTPException(400, {
      message: `Votre plan autorise ${limites.variantes} variante(s) de routage au maximum.`,
    });
  }

  if (limites.regles !== null && config.regles.length > limites.regles) {
    throw new HTTPException(400, {
      message: `Votre plan autorise ${limites.regles} règle(s) de routage au maximum.`,
    });
  }
}
