// services/routing/resolve.ts
// Resolveur pur : aucun I/O, aucune lecture d'horloge interne.
// `maintenant` est injecte => tests deterministes, y compris sur les fuseaux.
import type {
  RoutingConfig,
  RoutingEtapeEvaluation,
  RoutingRegle,
  RoutingVariante,
} from "@free-qr/shared-types";
import type { ContexteScan } from "../context.js";

export const FUSEAU_DEFAUT = "Africa/Brazzaville";

export interface Resolution {
  /** null quand aucune configuration exploitable n'est disponible. */
  variante: RoutingVariante | null;
  regleId: string | null;
  raison: string;
}

const JOURS: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Jour (1-7) et minutes depuis minuit dans le fuseau demande.
 * Un fuseau invalide retombe sur UTC au lieu de faire echouer la redirection.
 */
export function heureLocale(
  date: Date,
  fuseau: string,
): { jour: number; minutes: number } {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: fuseau });
  } catch {
    // Fuseau inconnu : UTC explicite (jamais le fuseau local de la machine).
    formatter = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" });
  }

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }

  // Intl peut rendre "24" pour minuit selon l'implementation.
  const heure = Number.parseInt(parts.hour ?? "0", 10) % 24;
  const minute = Number.parseInt(parts.minute ?? "0", 10);

  return {
    jour: JOURS[parts.weekday ?? "Mon"] ?? 1,
    minutes: heure * 60 + minute,
  };
}

function versMinutes(heure: string): number {
  return (
    Number.parseInt(heure.slice(0, 2), 10) * 60 +
    Number.parseInt(heure.slice(3, 5), 10)
  );
}

/** Plage [min, max) avec support du passage a minuit (22:00 → 02:00). */
export function dansPlage(minutes: number, min: string, max: string): boolean {
  const debut = versMinutes(min);
  const fin = versMinutes(max);
  if (debut === fin) return minutes === debut;
  return debut < fin
    ? minutes >= debut && minutes < fin
    : minutes >= debut || minutes < fin;
}

/** FNV-1a 32 bits : deterministe, rapide, suffisant pour une repartition A/B. */
export function hashStable(valeur: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < valeur.length; i++) {
    hash ^= valeur.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Tirage pondere deterministe : une meme graine renvoie toujours la meme
 * variante (le visiteur ne voit pas A puis B). `poids` absent = 1.
 */
export function tirerVariante(
  variantes: RoutingVariante[],
  graine: string,
): RoutingVariante {
  const total = variantes.reduce(
    (somme, variante) => somme + Math.max(1, variante.poids ?? 1),
    0,
  );
  let curseur = hashStable(graine) % total;
  for (const variante of variantes) {
    curseur -= Math.max(1, variante.poids ?? 1);
    if (curseur < 0) return variante;
  }
  return variantes[variantes.length - 1];
}

/** Comparaison de villes tolerante : casse et accents ignores. */
export function normaliserVille(ville: string): string {
  return ville
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function variantesDeRegle(
  regle: RoutingRegle,
  config: RoutingConfig,
): RoutingVariante[] {
  const ids = Array.isArray(regle.varianteId) ? regle.varianteId : [regle.varianteId];
  const trouvees: RoutingVariante[] = [];
  for (const id of ids) {
    const variante = config.variantes.find((v) => v.id === id);
    if (variante) trouvees.push(variante);
  }
  return trouvees;
}

/** Choisit la variante servie par une regle qui vient de correspondre. */
function varianteGagnante(
  regle: RoutingRegle,
  config: RoutingConfig,
  graine: string | undefined,
): RoutingVariante | null {
  const candidates = variantesDeRegle(regle, config);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  return tirerVariante(candidates, graine ?? "");
}

/**
 * Evalue une regle. Renvoie null si elle correspond, sinon le motif d'echec
 * (utile au simulateur). Une condition absente est un joker ; une condition
 * presente mais un contexte inconnu ne correspond jamais : on ne devine pas.
 */
function evaluerRegle(
  regle: RoutingRegle,
  ctx: ContexteScan,
  jour: number,
  minutes: number,
): string | null {
  const c = regle.conditions;

  if (c.jours && !c.jours.includes(jour)) {
    return `jour ${jour} hors de [${c.jours.join(", ")}]`;
  }

  if (c.heureMin && c.heureMax && !dansPlage(minutes, c.heureMin, c.heureMax)) {
    return `heure locale hors de ${c.heureMin}–${c.heureMax}`;
  }

  if (c.dates) {
    const instant = ctx.maintenant.getTime();
    const debut = Date.parse(c.dates.debut);
    const fin = Date.parse(c.dates.fin);
    if (!Number.isFinite(debut) || !Number.isFinite(fin)) {
      return "bornes de dates invalides";
    }
    if (instant < debut || instant > fin) {
      return `instant hors de ${c.dates.debut} → ${c.dates.fin}`;
    }
  }

  if (c.pays) {
    if (!ctx.pays) return "pays inconnu";
    if (!c.pays.includes(ctx.pays)) return `pays ${ctx.pays} hors de [${c.pays.join(", ")}]`;
  }

  if (c.villes) {
    if (!ctx.ville) return "ville inconnue";
    const ville = normaliserVille(ctx.ville);
    if (!c.villes.some((v) => normaliserVille(v) === ville)) {
      return `ville ${ctx.ville} hors de [${c.villes.join(", ")}]`;
    }
  }

  if (c.langues) {
    if (!ctx.langue) return "langue inconnue";
    if (!c.langues.includes(ctx.langue)) {
      return `langue ${ctx.langue} hors de [${c.langues.join(", ")}]`;
    }
  }

  if (c.appareil && !c.appareil.includes(ctx.appareil)) {
    return `appareil ${ctx.appareil} hors de [${c.appareil.join(", ")}]`;
  }

  if (c.minScansTotal !== undefined && ctx.scansTotal < c.minScansTotal) {
    return `${ctx.scansTotal} scans < min ${c.minScansTotal}`;
  }

  if (c.maxScansTotal !== undefined && ctx.scansTotal >= c.maxScansTotal) {
    return `${ctx.scansTotal} scans ≥ max ${c.maxScansTotal}`;
  }

  if (c.minScansAppareil !== undefined || c.maxScansAppareil !== undefined) {
    if (!ctx.consentementAppareil || ctx.scansAppareil === undefined) {
      return "scans appareil inconnus (pas de consentement)";
    }
    if (
      c.minScansAppareil !== undefined &&
      ctx.scansAppareil < c.minScansAppareil
    ) {
      return `${ctx.scansAppareil} scans appareil < min ${c.minScansAppareil}`;
    }
    if (
      c.maxScansAppareil !== undefined &&
      ctx.scansAppareil >= c.maxScansAppareil
    ) {
      return `${ctx.scansAppareil} scans appareil ≥ max ${c.maxScansAppareil}`;
    }
  }

  return null;
}

function trierRegles(config: RoutingConfig): RoutingRegle[] {
  return [...config.regles].sort((a, b) => a.priorite - b.priorite);
}

export function resoudreVariante(
  config: RoutingConfig | null | undefined,
  ctx: ContexteScan,
): Resolution {
  if (!config || !config.actif) {
    return { variante: null, regleId: null, raison: "config absente ou inactive" };
  }

  const defaut = config.variantes.find((v) => v.id === config.defaut);
  if (!defaut) {
    return { variante: null, regleId: null, raison: "variante par défaut introuvable" };
  }

  const { jour, minutes } = heureLocale(
    ctx.maintenant,
    config.fuseau || FUSEAU_DEFAUT,
  );

  for (const regle of trierRegles(config)) {
    if (evaluerRegle(regle, ctx, jour, minutes) !== null) continue;

    const variante = varianteGagnante(regle, config, ctx.graine);
    if (!variante) continue; // configuration incoherente : on ignore la regle

    const abTest = Array.isArray(regle.varianteId);
    return {
      variante,
      regleId: regle.id,
      raison: `règle ${regle.id}${abTest ? " (A/B)" : ""}`,
    };
  }

  return { variante: defaut, regleId: null, raison: "défaut" };
}

export interface ResolutionDetaillee {
  resolution: Resolution;
  etapes: RoutingEtapeEvaluation[];
}

/** Meme logique que `resoudreVariante`, en exposant le motif de chaque regle. */
export function resoudreVarianteDetaillee(
  config: RoutingConfig | null | undefined,
  ctx: ContexteScan,
): ResolutionDetaillee {
  const resolution = resoudreVariante(config, ctx);
  const etapes: RoutingEtapeEvaluation[] = [];

  if (config && config.actif) {
    const { jour, minutes } = heureLocale(
      ctx.maintenant,
      config.fuseau || FUSEAU_DEFAUT,
    );

    for (const regle of trierRegles(config)) {
      const motif = evaluerRegle(regle, ctx, jour, minutes);
      etapes.push({
        regleId: regle.id,
        priorite: regle.priorite,
        varianteId: regle.varianteId,
        correspond: motif === null,
        motif: motif ?? "correspond",
      });
    }
  }

  return { resolution, etapes };
}
