import type { InternalId, PublicId } from "./utilisateur.js";

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
  type: TypeQR;
  contenu: string;
  design?: QRCodeDesign;
}

export interface QRCodeUpdateInput {
  contenu?: string;
  estActif?: boolean;
  parametres?: QRCodeDesign;
}

export interface QRCodeListQuery {
  page?: number;
  limit?: number;
  type?: TypeQR;
  search?: string;
}
