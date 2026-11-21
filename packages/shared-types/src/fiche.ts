import type { PublicId } from './utilisateur.js';

/**
 * Types de champs d'une fiche.
 *
 * `section` est un titre de groupe : il ne porte pas de valeur.
 */
export type TypeChampFiche =
  | 'texte'
  | 'texte_long'
  | 'email'
  | 'telephone'
  | 'url'
  | 'date'
  | 'nombre'
  | 'liste'
  | 'booleen'
  | 'section';

export interface OptionChampFiche {
  valeur: string;
  libelle: string;
}

export interface ChampFiche {
  /** Slug stable : [a-z][a-z0-9_]{0,31}. Immuable après la première sauvegarde. */
  cle: string;
  /** Libellé affiché : 1 à 80 caractères. */
  libelle: string;
  type: TypeChampFiche;
  obligatoire?: boolean;
  aide?: string;
  placeholder?: string;
  /** Requis si `type = 'liste'`. */
  options?: OptionChampFiche[];
}

/** Présentation d'une fiche. Absent = document générique. */
export type NatureFiche = 'document' | 'carte';

/**
 * Clés conventionnelles d'une fiche de nature « carte ».
 *
 * Le builder propose ces clés par défaut ; l'export vCard les reconnaît pour
 * produire des propriétés normalisées (N, ORG, TEL, EMAIL, URL, ADR, NOTE).
 * Une fiche reste libre : les champs hors convention sont rendus sur la page
 * et ajoutés à la note de la vCard.
 */
export const CLES_CARTE = {
  prenom: 'prenom',
  nom: 'nom',
  organisation: 'organisation',
  fonction: 'fonction',
  telephone: 'telephone',
  email: 'email',
  site: 'site',
  adresse: 'adresse',
  note: 'note',
} as const;

export type CleCarte = (typeof CLES_CARTE)[keyof typeof CLES_CARTE];

export interface SchemaFiche {
  /** Version du format de schéma. */
  version: 1;
  /** `carte` active le rendu carte de visite et l'export vCard. */
  nature?: NatureFiche;
  champs: ChampFiche[];
}

export type ValeurFiche = string | number | boolean | null;
export type ValeursFiche = Record<string, ValeurFiche>;

/** Modèle réutilisable (schéma nommé). */
export interface FicheModele {
  id: PublicId;
  idUtilisateur: PublicId;
  nom: string;
  description?: string;
  schema: SchemaFiche;
  version: number;
  estPublic: boolean;
  dateCreation: Date | string;
  dateModification?: Date | string;
}

/** Fiche complète, réservée au propriétaire. */
export interface Fiche {
  id: PublicId;
  idUtilisateur: PublicId;
  idModele?: PublicId;
  titre: string;
  schema: SchemaFiche;
  valeurs: ValeursFiche;
  /** Révision de la fiche (incrémentée à chaque mise à jour). */
  version: number;
  estActive: boolean;
  dateCreation: Date | string;
  dateModification?: Date | string;
}

/** Payload public : aucune donnée interne. */
export interface FichePublique {
  publicId: string;
  titre: string;
  schema: SchemaFiche;
  valeurs: ValeursFiche;
  version: number;
  dateModification?: Date | string;
}

export interface FicheModeleInput {
  nom: string;
  description?: string;
  schema: SchemaFiche;
  estPublic?: boolean;
}

export interface FicheModeleUpdateInput {
  nom?: string;
  description?: string;
  schema?: SchemaFiche;
  estPublic?: boolean;
}

export interface FicheInput {
  titre: string;
  idModele?: PublicId;
  /** Requis si `idModele` est absent. */
  schema?: SchemaFiche;
  valeurs: ValeursFiche;
}

export interface FicheUpdateInput {
  titre?: string;
  schema?: SchemaFiche;
  valeurs?: ValeursFiche;
  /** Archivage (false) ou réactivation (true). */
  estActive?: boolean;
}

export interface FicheListQuery {
  page?: number;
  limit?: number;
  search?: string;
}
