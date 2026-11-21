// services/routing/config.ts
// Parsing tolerant de la configuration stockee en JSON sur `qrcodes`.
// Volontairement sans Zod ici : ce code tourne sur le chemin chaud de la
// redirection. La validation stricte se fait a l'ecriture (routes).
import type { RoutingConfig } from "@free-qr/shared-types";

export const FUSEAU_DEFAUT = "Africa/Brazzaville";

/**
 * Retourne la configuration, ou null si absente/corrompue.
 * Ne jette jamais : un QR imprime ne doit pas tomber en 500 a cause d'un JSON.
 */
export function parseConfigRoutage(raw: unknown): RoutingConfig | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const config = parsed as Partial<RoutingConfig>;
    if (
      config.version !== 1 ||
      !Array.isArray(config.variantes) ||
      config.variantes.length === 0 ||
      !Array.isArray(config.regles) ||
      typeof config.defaut !== "string"
    ) {
      return null;
    }
    return config as RoutingConfig;
  } catch {
    return null;
  }
}

export function estFuseauValide(fuseau: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: fuseau });
    return true;
  } catch {
    return false;
  }
}
