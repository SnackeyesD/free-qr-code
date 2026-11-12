// services/appareil.ts
// Compteur de scans par appareil et consentement (phase 4).
//
// Principes :
//  - le cookie `cfq_did` contient un UUID aleatoire, jamais une identite ;
//  - la base ne recoit qu'un hash `sha256(uuid + JWT_TRACKING_SECRET)` tronque ;
//  - le compteur de redirection vit dans le cookie `cfq_c` (aucune lecture D1
//    sur le chemin chaud) ; `appareils_qr` sert d'agregat d'audit ;
//  - aucun cookie non essentiel n'est pose sans une action explicite.
import type { AppEnv } from "../types/index.js";
import type { RoutingConfig } from "@free-qr/shared-types";
import { d1First, d1Run } from "../lib/db.js";

export const COOKIE_APPAREIL = "cfq_did";
export const COOKIE_REFUS = "cfq_refus";
export const COOKIE_COMPTEUR = "cfq_c";

/** Recommandation CNIL : 13 mois pour le consentement, 6 mois pour le refus. */
export const DUREE_APPAREIL_SECONDES = 13 * 30 * 24 * 60 * 60;
export const DUREE_REFUS_SECONDES = 6 * 30 * 24 * 60 * 60;

export const FINALITE_COMPTAGE = "comptage_appareil";
export const VERSION_TEXTE_CONSENTEMENT = "v1-2026-11";

/** Limite le cookie compteur : 8 QR au plus, ~200 octets. */
const MAX_COMPTEURS = 8;
const MAX_SCANS_COMPTEUR = 1_000_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALIAS_RE = /^[a-z0-9]{1,32}$/;

export function estUuidValide(valeur: string | undefined | null): valeur is string {
  return typeof valeur === "string" && UUID_RE.test(valeur);
}

/**
 * Hash pseudonyme de l'identifiant d'appareil. Tronque a 128 bits : suffisant
 * pour distinguer des appareils, inutile pour toute autre finalite.
 */
export async function hashAppareil(
  idAppareil: string,
  secret: string,
): Promise<string> {
  const donnees = new TextEncoder().encode(`${idAppareil}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", donnees);
  return Array.from(new Uint8Array(digest))
    .map((octet) => octet.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function parserCompteurs(valeur: string | undefined): Array<[string, number]> {
  if (!valeur) return [];
  const entrees: Array<[string, number]> = [];
  for (const morceau of valeur.split("~")) {
    const [alias, brut] = morceau.split(":");
    const nombre = Number.parseInt(brut ?? "", 10);
    if (!alias || !ALIAS_RE.test(alias)) continue;
    if (!Number.isFinite(nombre) || nombre < 0) continue;
    entrees.push([alias, Math.min(nombre, MAX_SCANS_COMPTEUR)]);
  }
  return entrees;
}

/**
 * Nombre de scans deja effectues sur cet appareil pour ce QR.
 * 0 si le cookie est absent, corrompu ou ne concerne pas ce QR.
 */
export function lireCompteur(valeur: string | undefined, alias: string): number {
  const entree = parserCompteurs(valeur).find(([cle]) => cle === alias);
  return entree?.[1] ?? 0;
}

/** Incremente le compteur de l'alias et serialise le cookie (8 entrees max). */
export function incrementerCompteur(
  valeur: string | undefined,
  alias: string,
): string {
  const entrees = parserCompteurs(valeur).filter(([cle]) => cle !== alias);
  const nouveau = Math.min(lireCompteur(valeur, alias) + 1, MAX_SCANS_COMPTEUR);
  entrees.push([alias, nouveau]);
  return entrees
    .slice(-MAX_COMPTEURS)
    .map(([cle, nombre]) => `${cle}:${nombre}`)
    .join("~");
}

/**
 * Une configuration a besoin d'un consentement si au moins une regle active
 * utilise une condition « appareil ». On ne cherche pas a savoir si la regle
 * aurait effectivement matche : le QR entier est concerne, c'est plus simple
 * a expliquer et cela evite de demander le consentement a chaque scan.
 */
export function configNecessiteConsentement(
  config: RoutingConfig | null | undefined,
): boolean {
  if (!config || !config.actif) return false;
  return config.regles.some(
    (regle) =>
      regle.conditions.minScansAppareil !== undefined ||
      regle.conditions.maxScansAppareil !== undefined,
  );
}

/** Enregistre la preuve de consentement (idempotent tant qu'il est actif). */
export async function enregistrerConsentement(
  env: AppEnv["Bindings"],
  idAppareilHash: string,
  dateISO: string,
): Promise<void> {
  const existant = await d1First<{ id: number }>(
    env,
    `SELECT id FROM consentements
     WHERE id_appareil = ? AND finalite = ? AND date_retrait IS NULL
     LIMIT 1`,
    idAppareilHash,
    FINALITE_COMPTAGE,
  );
  if (existant) return;

  await d1Run(
    env,
    `INSERT INTO consentements
       (id_appareil, finalite, version_texte, date_consentement)
     VALUES (?, ?, ?, ?)`,
    idAppareilHash,
    FINALITE_COMPTAGE,
    VERSION_TEXTE_CONSENTEMENT,
    dateISO,
  );
}

/**
 * Retrait du consentement : on horodate, on delie l'historique et on supprime
 * l'agregat appareil. Les scans restent comptes, mais plus jamais attribues.
 */
export async function retirerConsentement(
  env: AppEnv["Bindings"],
  idAppareilHash: string,
  dateISO: string,
): Promise<void> {
  await d1Run(
    env,
    `UPDATE consentements
     SET date_retrait = ?
     WHERE id_appareil = ? AND finalite = ? AND date_retrait IS NULL`,
    dateISO,
    idAppareilHash,
    FINALITE_COMPTAGE,
  );
  await d1Run(
    env,
    `UPDATE scans SET id_appareil = NULL WHERE id_appareil = ?`,
    idAppareilHash,
  );
  await d1Run(
    env,
    `DELETE FROM appareils_qr WHERE id_appareil = ?`,
    idAppareilHash,
  );
}
