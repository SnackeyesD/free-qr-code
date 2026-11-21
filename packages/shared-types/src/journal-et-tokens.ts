import type { InternalId, PublicId } from './utilisateur.js';

export type ActionJournalQRCode =
  | 'modification_cible'
  | 'activation'
  | 'desactivation'
  | 'suppression';

export interface JournalQRCode {
  id: PublicId;
  idQRCode: PublicId;
  idUtilisateur: PublicId;
  action: ActionJournalQRCode;
  ancienneValeur?: Record<string, unknown>;
  nouvelleValeur?: Record<string, unknown>;
  date: Date | string;
}

export interface JournalQRCodeInternal {
  id: InternalId;
  idQRCode: InternalId;
  idUtilisateur: InternalId;
  action: ActionJournalQRCode;
  ancienneValeur?: Record<string, unknown>;
  nouvelleValeur?: Record<string, unknown>;
  date: Date | string;
}

export type TypeTokenEmail = 'verification' | 'reinitialisation';

export interface TokenEmail {
  id: PublicId;
  idUtilisateur: PublicId;
  tokenHash: string;
  type: TypeTokenEmail;
  dateExpiration: Date | string;
  dateUtilisation?: Date | string;
  estUtilise: boolean;
}

export interface TokenEmailInternal {
  id: InternalId;
  idUtilisateur: InternalId;
  tokenHash: string;
  type: TypeTokenEmail;
  dateExpiration: Date | string;
  dateUtilisation?: Date | string;
  estUtilise: boolean;
}

export interface RefreshToken {
  id: PublicId;
  idUtilisateur: PublicId;
  tokenHash: string;
  userAgent?: string;
  adresseIP?: string;
  dateCreation: Date | string;
  dateExpiration: Date | string;
  dateRevocation?: Date | string;
  estRevoke: boolean;
}

export interface RefreshTokenInternal {
  id: InternalId;
  idUtilisateur: InternalId;
  tokenHash: string;
  userAgent?: string;
  adresseIP?: string;
  dateCreation: Date | string;
  dateExpiration: Date | string;
  dateRevocation?: Date | string;
  estRevoke: boolean;
}

export interface Session {
  id: number | string;
  tokenHash: string;
  dateCreation?: Date | string;
  userAgent?: string;
  estRevoke?: boolean;
  adresseIP?: string;
  dateDerniereUtilisation?: Date | string;
  dateExpiration?: Date | string;
}
