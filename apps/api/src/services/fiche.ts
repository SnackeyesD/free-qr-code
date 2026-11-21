import { HTTPException } from "hono/http-exception";
import type {
  Fiche,
  FicheModele,
  FichePublique,
  SchemaFiche,
  ValeursFiche,
  ValeurFiche,
  ChampFiche,
} from "@free-qr/shared-types";
import type { AppEnv } from "../types/index.js";
import { d1All, d1First, d1Insert, d1Run } from "../lib/db.js";
import { estUrlHttpSure } from "../lib/destination.js";
import type {
  CreateFicheInput,
  CreateFicheModeleInput,
  ListFichesInput,
  UpdateFicheInput,
  UpdateFicheModeleInput,
} from "../validators/fiche.js";

const TAILLE_MAX_VALEURS = 16 * 1024;

interface FicheRow {
  id: number;
  public_id: string;
  id_utilisateur: number;
  id_modele: number | null;
  titre: string;
  schema_snapshot: string;
  valeurs_json: string;
  version: number;
  est_active: number;
  date_creation: string;
  updated_at: string;
}

type FicheRowAvecModele = FicheRow & {
  modele_public_id: string | null;
};

interface FicheModeleRow {
  id: number;
  public_id: string;
  id_utilisateur: number;
  nom: string;
  description: string | null;
  schema_json: string;
  version: number;
  est_public: number;
  date_creation: string;
  updated_at: string;
}

export interface FichePourQr {
  idInterne: number;
  publicId: string;
  schema: SchemaFiche;
  valeurs: ValeursFiche;
}

function identifiantUtilisateur(userId: string): number {
  const id = Number(userId);
  if (!Number.isFinite(id)) {
    throw new HTTPException(400, { message: "Invalid user id" });
  }
  return id;
}

function schemaVide(): SchemaFiche {
  return { version: 1, champs: [] };
}

export function parseSchemaFiche(raw: string | null | undefined): SchemaFiche {
  if (!raw) return schemaVide();
  try {
    const parsed = JSON.parse(raw) as SchemaFiche;
    if (!parsed || !Array.isArray(parsed.champs)) return schemaVide();
    const nature =
      parsed.nature === "carte" || parsed.nature === "document"
        ? parsed.nature
        : undefined;
    return {
      version: 1,
      ...(nature ? { nature } : {}),
      champs: parsed.champs,
    };
  } catch (err) {
    console.error("Fiche: schéma illisible, rendu vide", err);
    return schemaVide();
  }
}

export function parseValeursFiche(
  raw: string | null | undefined,
): ValeursFiche {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ValeursFiche;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.error("Fiche: valeurs illisibles, rendu vide", err);
    return {};
  }
}

function estVide(valeur: ValeurFiche | undefined): boolean {
  return (
    valeur === undefined ||
    valeur === null ||
    (typeof valeur === "string" && valeur.trim().length === 0)
  );
}

function refuser(message: string): never {
  throw new HTTPException(400, { message });
}

function normaliserValeur(champ: ChampFiche, brute: ValeurFiche): ValeurFiche {
  switch (champ.type) {
    case "texte": {
      const valeur = String(brute).trim();
      if (valeur.length > 2000) {
        refuser(`Le champ « ${champ.libelle} » dépasse 2 000 caractères`);
      }
      return valeur;
    }
    case "texte_long": {
      const valeur = String(brute).trim();
      if (valeur.length > 10000) {
        refuser(`Le champ « ${champ.libelle} » dépasse 10 000 caractères`);
      }
      return valeur;
    }
    case "email": {
      const valeur = String(brute).trim();
      if (valeur.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur)) {
        refuser(`Le champ « ${champ.libelle} » n'est pas un email valide`);
      }
      return valeur;
    }
    case "telephone": {
      const valeur = String(brute).trim();
      if (!/^\+?[0-9 ().-]{5,32}$/.test(valeur)) {
        refuser(`Le champ « ${champ.libelle} » n'est pas un téléphone valide`);
      }
      return valeur;
    }
    case "url": {
      const valeur = String(brute).trim();
      if (!estUrlHttpSure(valeur)) {
        refuser(`Le champ « ${champ.libelle} » doit être une URL http(s)`);
      }
      return valeur;
    }
    case "date": {
      const valeur = String(brute).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
        refuser(`Le champ « ${champ.libelle} » doit être une date AAAA-MM-JJ`);
      }
      const date = new Date(`${valeur}T00:00:00.000Z`);
      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== valeur
      ) {
        refuser(`Le champ « ${champ.libelle} » n'est pas une date valide`);
      }
      return valeur;
    }
    case "nombre": {
      const valeur = typeof brute === "number" ? brute : Number(String(brute));
      if (!Number.isFinite(valeur)) {
        refuser(`Le champ « ${champ.libelle} » doit être un nombre`);
      }
      return valeur;
    }
    case "liste": {
      const valeur = String(brute);
      const options = champ.options ?? [];
      if (!options.some((option) => option.valeur === valeur)) {
        refuser(`Le champ « ${champ.libelle} » n'est pas une option valide`);
      }
      return valeur;
    }
    case "booleen": {
      if (typeof brute === "boolean") return brute;
      const texte = String(brute).trim().toLowerCase();
      if (texte === "true" || texte === "1") return true;
      if (texte === "false" || texte === "0") return false;
      refuser(`Le champ « ${champ.libelle} » doit être vrai ou faux`);
    }
    case "section":
    default:
      return String(brute);
  }
}

/**
 * Valide les valeurs contre le schéma et ne conserve que les clés connues.
 * Les champs facultatifs vides sont stockés à `null` (le rendu les masque).
 */
export function validerValeursFiche(
  schema: SchemaFiche,
  valeurs: ValeursFiche,
): ValeursFiche {
  const resultat: ValeursFiche = {};

  for (const champ of schema.champs) {
    if (champ.type === "section") continue;

    const brute = valeurs[champ.cle];
    if (estVide(brute)) {
      if (champ.obligatoire) {
        refuser(`Le champ « ${champ.libelle} » est obligatoire`);
      }
      resultat[champ.cle] = null;
      continue;
    }

    resultat[champ.cle] = normaliserValeur(champ, brute as ValeurFiche);
  }

  const json = JSON.stringify(resultat);
  if (json.length > TAILLE_MAX_VALEURS) {
    refuser("Le contenu de la fiche dépasse 16 Ko");
  }
  return resultat;
}

/** Vrai si tous les champs obligatoires sont renseignés. */
export function ficheComplete(
  schema: SchemaFiche,
  valeurs: ValeursFiche,
): boolean {
  return schema.champs.every(
    (champ) =>
      champ.type === "section" ||
      !champ.obligatoire ||
      !estVide(valeurs[champ.cle]),
  );
}

function toPublicModele(row: FicheModeleRow): FicheModele {
  return {
    id: row.public_id,
    idUtilisateur: String(row.id_utilisateur),
    nom: row.nom,
    description: row.description ?? undefined,
    schema: parseSchemaFiche(row.schema_json),
    version: row.version,
    estPublic: row.est_public === 1,
    dateCreation: row.date_creation,
    dateModification: row.updated_at,
  };
}

function toPublicFiche(row: FicheRowAvecModele): Fiche {
  return {
    id: row.public_id,
    idUtilisateur: String(row.id_utilisateur),
    idModele: row.modele_public_id ?? undefined,
    titre: row.titre,
    schema: parseSchemaFiche(row.schema_snapshot),
    valeurs: parseValeursFiche(row.valeurs_json),
    version: row.version,
    estActive: row.est_active === 1,
    dateCreation: row.date_creation,
    dateModification: row.updated_at,
  };
}

async function chargerModeleRow(
  env: AppEnv["Bindings"],
  idUtilisateur: number,
  publicId: string,
): Promise<FicheModeleRow | null> {
  return d1First<FicheModeleRow>(
    env,
    "SELECT * FROM fiches_modeles WHERE public_id = ? AND id_utilisateur = ?",
    publicId,
    idUtilisateur,
  );
}

async function chargerFicheRow(
  env: AppEnv["Bindings"],
  idUtilisateur: number,
  publicId: string,
): Promise<FicheRowAvecModele | null> {
  return d1First<FicheRowAvecModele>(
    env,
    `SELECT f.*, m.public_id AS modele_public_id
       FROM fiches f
       LEFT JOIN fiches_modeles m ON m.id = f.id_modele
      WHERE f.public_id = ? AND f.id_utilisateur = ?`,
    publicId,
    idUtilisateur,
  );
}

export async function createFiche(
  env: AppEnv["Bindings"],
  userId: string,
  input: CreateFicheInput,
): Promise<Fiche> {
  const idUtilisateur = identifiantUtilisateur(userId);

  let schema: SchemaFiche;
  let idModele: number | null = null;
  let modelePublicId: string | null = null;

  if (input.idModele) {
    const modele = await chargerModeleRow(env, idUtilisateur, input.idModele);
    if (!modele) {
      throw new HTTPException(404, { message: "Modèle de fiche introuvable" });
    }
    schema = parseSchemaFiche(modele.schema_json);
    idModele = modele.id;
    modelePublicId = modele.public_id;
  } else {
    if (!input.schema) {
      throw new HTTPException(400, { message: "Schéma de fiche requis" });
    }
    schema = input.schema;
  }

  const valeurs = validerValeursFiche(schema, input.valeurs);
  const publicId = crypto.randomUUID();
  const now = new Date().toISOString();

  const id = await d1Insert(
    env,
    `INSERT INTO fiches (
       public_id, id_utilisateur, id_modele, titre, schema_snapshot,
       valeurs_json, version, est_active, date_creation, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)`,
    publicId,
    idUtilisateur,
    idModele,
    input.titre,
    JSON.stringify(schema),
    JSON.stringify(valeurs),
    now,
    now,
    now,
  );

  if (!id) {
    throw new HTTPException(500, { message: "Failed to create fiche" });
  }

  return toPublicFiche({
    id,
    public_id: publicId,
    id_utilisateur: idUtilisateur,
    id_modele: idModele,
    titre: input.titre,
    schema_snapshot: JSON.stringify(schema),
    valeurs_json: JSON.stringify(valeurs),
    version: 1,
    est_active: 1,
    date_creation: now,
    updated_at: now,
    modele_public_id: modelePublicId,
  });
}

export async function listFiches(
  env: AppEnv["Bindings"],
  userId: string,
  query: ListFichesInput,
): Promise<{
  data: Fiche[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}> {
  const idUtilisateur = identifiantUtilisateur(userId);
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  const conditions = ["f.id_utilisateur = ?"];
  const params: Array<string | number> = [idUtilisateur];
  if (query.search?.trim()) {
    conditions.push("f.titre LIKE ?");
    params.push(`%${query.search.trim()}%`);
  }
  const where = conditions.join(" AND ");

  const totalRow = await d1First<{ total: number }>(
    env,
    `SELECT COUNT(*) AS total FROM fiches f WHERE ${where}`,
    ...params,
  );
  const total = totalRow?.total ?? 0;

  const rows = await d1All<FicheRowAvecModele>(
    env,
    `SELECT f.*, m.public_id AS modele_public_id
       FROM fiches f
       LEFT JOIN fiches_modeles m ON m.id = f.id_modele
      WHERE ${where}
      ORDER BY f.date_creation DESC
      LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  return {
    data: rows.map(toPublicFiche),
    total,
    page,
    limit,
    hasNext: offset + rows.length < total,
  };
}

export async function getFicheById(
  env: AppEnv["Bindings"],
  userId: string,
  publicId: string,
): Promise<Fiche> {
  const idUtilisateur = identifiantUtilisateur(userId);
  const row = await chargerFicheRow(env, idUtilisateur, publicId);
  if (!row) {
    throw new HTTPException(404, { message: "Fiche introuvable" });
  }
  return toPublicFiche(row);
}

export async function updateFiche(
  env: AppEnv["Bindings"],
  userId: string,
  publicId: string,
  input: UpdateFicheInput,
): Promise<Fiche> {
  const idUtilisateur = identifiantUtilisateur(userId);
  const existing = await chargerFicheRow(env, idUtilisateur, publicId);
  if (!existing) {
    throw new HTTPException(404, { message: "Fiche introuvable" });
  }

  let schema = parseSchemaFiche(existing.schema_snapshot);
  let valeurs = parseValeursFiche(existing.valeurs_json);

  if (input.schema !== undefined || input.valeurs !== undefined) {
    schema = input.schema ?? schema;
    valeurs = validerValeursFiche(schema, input.valeurs ?? valeurs);
  }

  const titre = input.titre ?? existing.titre;
  const estActive =
    input.estActive === undefined
      ? existing.est_active
      : input.estActive
        ? 1
        : 0;
  const version = existing.version + 1;
  const now = new Date().toISOString();

  await d1Run(
    env,
    `UPDATE fiches
        SET titre = ?, schema_snapshot = ?, valeurs_json = ?, version = ?,
            est_active = ?, updated_at = ?
      WHERE id = ?`,
    titre,
    JSON.stringify(schema),
    JSON.stringify(valeurs),
    version,
    estActive,
    now,
    existing.id,
  );

  return toPublicFiche({
    ...existing,
    titre,
    schema_snapshot: JSON.stringify(schema),
    valeurs_json: JSON.stringify(valeurs),
    version,
    est_active: estActive,
    updated_at: now,
  });
}

export async function deleteFiche(
  env: AppEnv["Bindings"],
  userId: string,
  publicId: string,
): Promise<void> {
  const idUtilisateur = identifiantUtilisateur(userId);
  const existing = await chargerFicheRow(env, idUtilisateur, publicId);
  if (!existing) {
    throw new HTTPException(404, { message: "Fiche introuvable" });
  }

  const liee = await d1First<{ total: number }>(
    env,
    "SELECT COUNT(*) AS total FROM qrcodes WHERE id_fiche = ?",
    existing.id,
  );
  if ((liee?.total ?? 0) > 0) {
    throw new HTTPException(409, {
      message:
        "Cette fiche est liée à un QR code. Déliez ou supprimez les QR codes avant de la supprimer.",
    });
  }

  await d1Run(env, "DELETE FROM fiches WHERE id = ?", existing.id);
}

export async function getFichePublique(
  env: AppEnv["Bindings"],
  publicId: string,
): Promise<FichePublique> {
  const row = await d1First<FicheRow>(
    env,
    `SELECT id, public_id, id_utilisateur, id_modele, titre, schema_snapshot,
            valeurs_json, version, est_active, date_creation, updated_at
       FROM fiches
      WHERE public_id = ?`,
    publicId,
  );
  if (!row) {
    throw new HTTPException(404, { message: "Fiche introuvable" });
  }
  if (row.est_active !== 1) {
    throw new HTTPException(410, { message: "Fiche archivée" });
  }

  return {
    publicId: row.public_id,
    titre: row.titre,
    schema: parseSchemaFiche(row.schema_snapshot),
    valeurs: parseValeursFiche(row.valeurs_json),
    version: row.version,
    dateModification: row.updated_at,
  };
}

/**
 * Charge une fiche pour la lier à un QR : vérifie l'ownership, l'activité et
 * la complétude des champs obligatoires.
 */
export async function chargerFichePourQr(
  env: AppEnv["Bindings"],
  userId: string,
  publicId: string,
): Promise<FichePourQr> {
  const idUtilisateur = identifiantUtilisateur(userId);
  const row = await chargerFicheRow(env, idUtilisateur, publicId);
  if (!row) {
    throw new HTTPException(404, { message: "Fiche introuvable" });
  }
  if (row.est_active !== 1) {
    throw new HTTPException(409, { message: "Cette fiche est archivée" });
  }

  const schema = parseSchemaFiche(row.schema_snapshot);
  const valeurs = parseValeursFiche(row.valeurs_json);
  if (!ficheComplete(schema, valeurs)) {
    throw new HTTPException(400, {
      message: "Complétez les champs obligatoires avant de créer le QR code",
    });
  }

  return {
    idInterne: row.id,
    publicId: row.public_id,
    schema,
    valeurs,
  };
}

/** URL publique de rendu d'une fiche. */
export function construireUrlPublique(
  env: AppEnv["Bindings"],
  publicId: string,
): string {
  const base = String(env.FRONTEND_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  if (!base) {
    throw new HTTPException(500, {
      message: "FRONTEND_URL manquant : impossible de construire l'URL de la fiche",
    });
  }
  return `${base}/d/${encodeURIComponent(publicId)}`;
}

// ---------------------------------------------------------------------------
// Modèles de fiches
// ---------------------------------------------------------------------------

export async function createFicheModele(
  env: AppEnv["Bindings"],
  userId: string,
  input: CreateFicheModeleInput,
): Promise<FicheModele> {
  const idUtilisateur = identifiantUtilisateur(userId);
  const publicId = crypto.randomUUID();
  const now = new Date().toISOString();

  const id = await d1Insert(
    env,
    `INSERT INTO fiches_modeles (
       public_id, id_utilisateur, nom, description, schema_json, version,
       est_public, date_creation, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    publicId,
    idUtilisateur,
    input.nom,
    input.description ?? null,
    JSON.stringify(input.schema),
    input.estPublic ? 1 : 0,
    now,
    now,
    now,
  );

  if (!id) {
    throw new HTTPException(500, { message: "Failed to create fiche model" });
  }

  return toPublicModele({
    id,
    public_id: publicId,
    id_utilisateur: idUtilisateur,
    nom: input.nom,
    description: input.description ?? null,
    schema_json: JSON.stringify(input.schema),
    version: 1,
    est_public: input.estPublic ? 1 : 0,
    date_creation: now,
    updated_at: now,
  });
}

export async function listFichesModeles(
  env: AppEnv["Bindings"],
  userId: string,
): Promise<{ data: FicheModele[]; total: number }> {
  const idUtilisateur = identifiantUtilisateur(userId);
  const rows = await d1All<FicheModeleRow>(
    env,
    `SELECT * FROM fiches_modeles
      WHERE id_utilisateur = ?
      ORDER BY nom COLLATE NOCASE ASC`,
    idUtilisateur,
  );
  return { data: rows.map(toPublicModele), total: rows.length };
}

export async function getFicheModeleById(
  env: AppEnv["Bindings"],
  userId: string,
  publicId: string,
): Promise<FicheModele> {
  const idUtilisateur = identifiantUtilisateur(userId);
  const row = await chargerModeleRow(env, idUtilisateur, publicId);
  if (!row) {
    throw new HTTPException(404, { message: "Modèle de fiche introuvable" });
  }
  return toPublicModele(row);
}

export async function updateFicheModele(
  env: AppEnv["Bindings"],
  userId: string,
  publicId: string,
  input: UpdateFicheModeleInput,
): Promise<FicheModele> {
  const idUtilisateur = identifiantUtilisateur(userId);
  const existing = await chargerModeleRow(env, idUtilisateur, publicId);
  if (!existing) {
    throw new HTTPException(404, { message: "Modèle de fiche introuvable" });
  }

  const nom = input.nom ?? existing.nom;
  const description =
    input.description === undefined
      ? existing.description
      : input.description;
  const schema =
    input.schema ?? parseSchemaFiche(existing.schema_json);
  const estPublic =
    input.estPublic === undefined
      ? existing.est_public
      : input.estPublic
        ? 1
        : 0;
  const version = existing.version + 1;
  const now = new Date().toISOString();

  await d1Run(
    env,
    `UPDATE fiches_modeles
        SET nom = ?, description = ?, schema_json = ?, version = ?,
            est_public = ?, updated_at = ?
      WHERE id = ?`,
    nom,
    description,
    JSON.stringify(schema),
    version,
    estPublic,
    now,
    existing.id,
  );

  return toPublicModele({
    ...existing,
    nom,
    description,
    schema_json: JSON.stringify(schema),
    version,
    est_public: estPublic,
    updated_at: now,
  });
}

export async function deleteFicheModele(
  env: AppEnv["Bindings"],
  userId: string,
  publicId: string,
): Promise<void> {
  const idUtilisateur = identifiantUtilisateur(userId);
  const existing = await chargerModeleRow(env, idUtilisateur, publicId);
  if (!existing) {
    throw new HTTPException(404, { message: "Modèle de fiche introuvable" });
  }
  await d1Run(env, "DELETE FROM fiches_modeles WHERE id = ?", existing.id);
}
