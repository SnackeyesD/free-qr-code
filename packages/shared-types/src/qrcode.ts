import type { InternalId, PublicId } from "./utilisateur.js";
import type { RoutingConfig } from "./routing.js";

export type { InternalId, PublicId };

export type TypeContenuQR =
  | "url"
  | "texte"
  | "email"
  | "telephone"
  | "sms"
  | "wifi"
  | "vcard"
  | "geo"
  | "pdf";

export type TypeQR = "statique" | "dynamique";

export interface QRCodeDesign {
  couleur?: string;
  background?: string;
  logoUrl?: string;
  taille?: number;
  correction?: "L" | "M" | "Q" | "H";
  cadre?: boolean;
  formatImage?: "png" | "svg" | "pdf";
  [key: string]: unknown;
}

export interface QRCode {
  id: PublicId;
  idUtilisateur: PublicId;
  contenu: string;
  typeContenu: TypeContenuQR;
  estDynamique: boolean;
  aliasCourt?: string;
  parametres: QRCodeDesign;
  estActif: boolean;
  dateCreation: Date | string;
  dateExpiration?: Date | string;
  nombreScansTotal: number;
  urlImage?: string;
  urlImagePng?: string;
  idModele?: PublicId;
  /** Fiche liée (QR dynamique dont le contenu est la page de rendu). */
  idFiche?: PublicId;
  /** Configuration de routage contextuel (null si désactivé). */
  reglesRoutage?: RoutingConfig | null;
  /** Fuseau de référence des règles horaires. */
  fuseau?: string;
}

export interface QRCodeInternal {
  id: InternalId;
  idUtilisateur: InternalId;
  contenu: string;
  typeContenu: TypeContenuQR;
  estDynamique: boolean;
  aliasCourt?: string;
  parametres: QRCodeDesign;
  estActif: boolean;
  dateCreation: Date | string;
  dateExpiration?: Date | string;
  nombreScansTotal: number;
  urlImage?: string;
  idModele?: InternalId;
}

export interface QRCodeInput {
  type?: TypeQR;
  /** Requis si `idFiche` est absent. */
  contenu?: string;
  /** Type du contenu. Déduit du contenu côté API si absent. */
  typeContenu?: TypeContenuQR;
  /** Crée un QR dynamique pointant vers la page de rendu de la fiche. */
  idFiche?: PublicId;
  design?: QRCodeDesign;
}

export interface QRCodeUpdateInput {
  contenu?: string;
  /** Type du nouveau contenu. Déduit du contenu côté API si absent. */
  typeContenu?: TypeContenuQR;
  /** Lie (ou délie avec `null`) une fiche au QR. */
  idFiche?: PublicId | null;
  estActif?: boolean;
  parametres?: QRCodeDesign;
}

export interface QRCodeListQuery {
  page?: number;
  limit?: number;
  type?: TypeQR;
  search?: string;
}
