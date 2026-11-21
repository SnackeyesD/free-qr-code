/**
 * Routage contextuel (ContextFlow QR).
 *
 * La configuration est stockée en JSON sur la ligne `qrcodes` : une seule
 * lecture D1, aucun join, sur le chemin chaud de la redirection.
 * Les identifiants de variantes sont stables (jamais réédités) afin que
 * l'historique des scans reste interprétable.
 */

import type { PlanUtilisateur } from './utilisateur.js';

export type TypeSortieRoutage = "url";

export type FamilleAppareil = "mobile" | "tablet" | "desktop";

export interface RoutingVariante {
  /** Identifiant stable, immuable après création (référencé par `scans.id_variante`). */
  id: string;
  libelle: string;
  /** Phase 1 : redirection URL uniquement. */
  typeSortie: TypeSortieRoutage;
  contenu: string;
  /** Réservé au test A/B pondéré (Phase 3). */
  poids?: number;
}

export interface RoutingConditions {
  /** 1 = lundi … 7 = dimanche, dans le fuseau du QR. */
  jours?: number[];
  /** "HH:MM". Supporte le passage minuit (ex. 22:00 → 02:00). */
  heureMin?: string;
  heureMax?: string;
  /** Codes ISO-3166 alpha-2 en majuscules, ex. ["CG", "FR"]. */
  pays?: string[];
  /** Codes ISO-639-1 en minuscules, ex. ["fr", "en"]. */
  langues?: string[];
  appareil?: FamilleAppareil[];
  minScansTotal?: number;
  maxScansTotal?: number;
  /**
   * Nombre de scans du **même appareil** (cookie consenti), ce scan inclus.
   * Absent du contexte ou consentement refuse = la condition ne correspond
   * jamais : on ne devine pas.
   */
  minScansAppareil?: number;
  maxScansAppareil?: number;
  /** Bornes ISO 8601 incluses, comparees a l'instant du scan. */
  dates?: { debut: string; fin: string };
  /** Villes `request.cf.city` (best-effort, comparees sans casse ni accents). */
  villes?: string[];
  /** Marque une regle de tirage pondere entre plusieurs variantes. */
  abTest?: boolean;
}

export interface RoutingRegle {
  id: string;
  /** Ordre d'évaluation croissant : la plus petite priorité est évaluée en premier. */
  priorite: number;
  /** Tableau = tirage pondéré entre ces variantes (règle `abTest`). */
  varianteId: string | string[];
  conditions: RoutingConditions;
}

export interface RoutingConfig {
  version: 1;
  actif: boolean;
  /** Fuseau IANA de référence des règles horaires, ex. "Africa/Brazzaville". */
  fuseau: string;
  /** Identifiant de la variante servie quand aucune règle ne correspond. */
  defaut: string;
  variantes: RoutingVariante[];
  regles: RoutingRegle[];
}

export interface RoutingSimulationInput {
  pays?: string;
  langue?: string;
  ville?: string;
  appareil?: FamilleAppareil;
  /**
   * Numéro de ce scan pour l'appareil simulé (1 = premier scan).
   * Omis = appareil inconnu : les conditions appareil ne correspondent pas.
   */
  scansAppareil?: number;
  /** Date ISO 8601. Par défaut : maintenant. */
  date?: string;
  /** Graine du tirage A/B (ex. IP anonymisée + User-Agent). */
  graine?: string;
}

export interface RoutingEtapeEvaluation {
  regleId: string;
  priorite: number;
  varianteId: string | string[];
  correspond: boolean;
  motif: string;
}

export interface RoutingSimulationResult {
  varianteId: string;
  libelle: string;
  contenu: string;
  /** null lorsque la variante par défaut est servie. */
  regleId: string | null;
  raison: string;
  contexte: RoutingSimulationInput & {
    pays?: string;
    langue?: string;
    appareil?: FamilleAppareil;
    scansTotal: number;
    scansAppareil?: number;
  };
  trace: RoutingEtapeEvaluation[];
}

export interface RoutingState {
  reglesRoutage: RoutingConfig | null;
  fuseau: string;
  estDynamique: boolean;
  contenu: string;
  /** Couture de monétisation : le front s'en sert pour bloquer l'édition, jamais le runtime. */
  limites: RoutingLimites;
}

/**
 * Limites d'édition du routage pour un compte.
 * `variantes`/`regles` à `null` = illimité. `autorise:false` bloque uniquement
 * la création/modification : les configurations existantes continuent de router.
 */
export interface RoutingLimites {
  plan: PlanUtilisateur;
  proOnly: boolean;
  autorise: boolean;
  variantes: number | null;
  regles: number | null;
}

/**
 * Instrumentation de la monétisation (Phase 5). Aucune donnée personnelle :
 * uniquement des comptages et des identifiants internes agrégés.
 */
export interface RoutingMetrics {
  /** État du flag commercial au moment de la mesure. */
  proOnly: boolean;
  qrTotal: number;
  /** QR dont `regles_routage` contient une configuration exploitable. */
  qrAvecRoutage: number;
  /** QR avec au moins deux variantes : usage réel du multi-destination. */
  qrMultiVariantes: number;
  /** Comptes distincts ayant configuré du routage : potentiel de conversion. */
  comptesRoutage: number;
  consultationsStats: {
    total: number;
    trenteJours: number;
    /** Comptes distincts ayant consulté l'écran de stats. */
    comptes: number;
  };
  plans: {
    gratuit: number;
    pro: number;
  };
  /** Date ISO 8601 de la mesure. */
  genereLe: string;
}

/**
 * Statistiques par variante (Phase 2).
 * On affiche des **scans**, jamais des « conversions » : aucune donnée de
 * conversion n'existe tant qu'il n'y a pas de page hôte (Phase 3).
 */
export interface RoutingVarianteStat {
  /** null = scans enregistrés sans routage (config absente ou inactive à l'époque). */
  varianteId: string | null;
  /** Libellé courant ; l'id brut si la variante a été supprimée de la config. */
  libelle: string;
  scans: number;
  scansUniques: number;
  /** Part dans le total, 0..1. */
  part: number;
  langues: Record<string, number>;
  pays: Record<string, number>;
  /** La variante n'existe plus dans la configuration actuelle. */
  supprimee: boolean;
}

export interface RoutingStatsAlerte {
  type: "variante_morte";
  varianteId: string;
  libelle: string;
  message: string;
}

export interface RoutingStatsResult {
  periode: { from?: string; to?: string };
  totalScans: number;
  scansUniques: number;
  /** Triées par scans décroissants. */
  variantes: RoutingVarianteStat[];
  alertes: RoutingStatsAlerte[];
}

