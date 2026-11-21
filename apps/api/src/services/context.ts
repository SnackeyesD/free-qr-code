// services/context.ts
// Extraction du contexte d'un scan, sans aucun appel réseau.
// Cloudflare calcule ces informations au niveau du edge (request.cf).
import type { AppContext } from "../types/index.js";

export type FamilleAppareil = "mobile" | "tablet" | "desktop";

/**
 * Sous-ensemble de `IncomingRequestCfProperties` réellement utilisé.
 * Typé localement pour rester testable hors Workers.
 */
export interface CfProprietes {
  country?: string;
  city?: string;
  region?: string;
  timezone?: string;
  uaPlatform?: string;
  asn?: number;
  asOrganization?: string;
  latitude?: string;
  longitude?: string;
}

/**
 * Contexte de décision d'un scan.
 * Sert au routage contextuel (heure, pays, langue, appareil) et à l'enregistrement.
 */
export interface ContexteScan {
  /** Instant du scan (injecté : le résolveur est pur, il ne lit jamais l'horloge). */
  maintenant: Date;
  /** ISO-3166 alpha-2 depuis cf.country. Fiable. */
  pays?: string;
  /** cf.city. Best-effort (fiable EU/US, souvent absent en Afrique centrale). */
  ville?: string;
  region?: string;
  /**
   * Fuseau du visiteur (informatif uniquement).
   * ⚠️ Ne jamais l'utiliser pour évaluer une règle horaire : le fuseau de
   * référence est celui du QR (Africa/Brazzaville par défaut).
   */
  fuseauVisiteur?: string;
  appareil: FamilleAppareil;
  /** Langue principale négociée depuis Accept-Language ("fr", "en"…). */
  langue?: string;
  asn?: number;
  asOrganisation?: string;
  /** Nombre de scans du QR avant ce scan (utilisé par min/maxScansTotal). */
  scansTotal: number;
  /**
   * Numéro de ce scan pour l'appareil (1 = premier scan), uniquement quand le
   * visiteur a consenti au comptage. `undefined` = appareil inconnu ou refus :
   * les conditions appareil ne correspondent jamais.
   */
  scansAppareil?: number;
  /** Vrai uniquement si le comptage par appareil est actif pour ce scan. */
  consentementAppareil?: boolean;
  /**
   * Graine stable du tirage A/B (IP anonymisée + User-Agent + alias).
   * Le résolveur reste pur : la graine est fournie par l'appelant.
   */
  graine?: string;
}

export function detecterAppareil(
  cf: CfProprietes | undefined,
  userAgent: string,
): FamilleAppareil {
  if (cf?.uaPlatform === "mobile") return "mobile";
  if (cf?.uaPlatform === "tablet") return "tablet";

  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet")) return "tablet";
  if (ua.includes("iphone") || ua.includes("android") || ua.includes("mobile")) {
    return "mobile";
  }
  return "desktop";
}

/** "fr-CG,fr;q=0.9,en;q=0.8" → "fr" */
export function languePreferee(header?: string): string | undefined {
  if (!header) return undefined;
  const premier = header.split(",")[0]?.trim();
  if (!premier) return undefined;
  const code = premier.split(";")[0]?.trim();
  if (!code || code === "*") return undefined;
  return code.split("-")[0]?.toLowerCase();
}

/**
 * Choisit la meilleure langue du visiteur parmi celles proposées par le QR.
 * Renvoie undefined si aucune correspondance (on ne devine pas).
 */
export function negocierLangue(
  header: string | undefined,
  disponibles: string[],
): string | undefined {
  if (!header || disponibles.length === 0) return undefined;

  const preferees = header
    .split(",")
    .map((partie) => {
      const [code, ...params] = partie.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const qualite = q ? Number.parseFloat(q.split("=")[1] ?? "1") : 1;
      return {
        code: (code ?? "").trim().split("-")[0]?.toLowerCase(),
        q: Number.isFinite(qualite) ? qualite : 0,
      };
    })
    .filter((p) => p.code && p.code !== "*")
    .sort((a, b) => b.q - a.q);

  for (const p of preferees) {
    if (disponibles.includes(p.code)) return p.code;
  }
  return undefined;
}

export function extraireContexte(c: AppContext, scansTotal: number): ContexteScan {
  const cf = (c.req.raw as unknown as { cf?: CfProprietes }).cf;
  const userAgent = c.req.header("User-Agent") ?? "";

  return {
    maintenant: new Date(),
    pays: cf?.country || undefined,
    ville: cf?.city || undefined,
    region: cf?.region || undefined,
    fuseauVisiteur: cf?.timezone || undefined,
    appareil: detecterAppareil(cf, userAgent),
    langue: languePreferee(c.req.header("Accept-Language")),
    asn: cf?.asn,
    asOrganisation: cf?.asOrganization,
    scansTotal,
    consentementAppareil: false,
  };
}
