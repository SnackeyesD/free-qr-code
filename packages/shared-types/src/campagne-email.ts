import type { InternalId, PublicId } from './utilisateur.js';

export type StatutCampagneEmail = 'brouillon' | 'programmee' | 'envoyee' | 'annulee';
export type CibleCampagneEmail = 'tous' | 'actifs' | 'inactifs' | 'non_verifies' | 'consentants';

export interface CampagneEmail {
  id: PublicId;
  idUtilisateur: PublicId;
  nom: string;
  sujet: string;
  titre?: string;
  contenu: string;
  corpsHtml?: string;
  corpsTexte?: string;
  cible: CibleCampagneEmail;
  statut: StatutCampagneEmail;
  dateEnvoi?: Date | string;
  dateCreation?: Date | string;
  nombreOuvertures: number;
  nombreClics: number;
}

export interface CampagneEmailInternal {
  id: InternalId;
  idUtilisateur: InternalId;
  nom: string;
  sujet: string;
  titre?: string;
  contenu: string;
  corpsHtml?: string;
  corpsTexte?: string;
  cible: CibleCampagneEmail;
  statut: StatutCampagneEmail;
  dateEnvoi?: Date | string;
  dateCreation?: Date | string;
  nombreOuvertures: number;
  nombreClics: number;
}

export interface CampagneEmailInput {
  nom: string;
  sujet: string;
  corpsHtml: string;
  corpsTexte?: string;
  cible?: CibleCampagneEmail;
}

export interface CampagneEnvoiInput {
  scheduledAt?: Date | string;
}

export interface CampagneUtilisateur {
  id: PublicId;
  idCampagne: PublicId;
  idUtilisateur: PublicId;
  dateEnvoiUtilisateur?: Date | string;
  estOuvert?: boolean;
  estClique?: boolean;
}

export interface CampagneUtilisateurInternal {
  id: InternalId;
  idCampagne: InternalId;
  idUtilisateur: InternalId;
  dateEnvoiUtilisateur?: Date | string;
  estOuvert?: boolean;
  estClique?: boolean;
}

export interface TrackingEmail {
  id: PublicId;
  idCampagne: PublicId;
  idUtilisateur: PublicId;
  type: 'ouverture' | 'clic';
  tokenTracking: string;
  urlCible?: string;
  userAgent?: string;
  adresseIP?: string;
  dateEvenement: Date | string;
}

export interface TrackingEmailInternal {
  id: InternalId;
  idCampagne: InternalId;
  idUtilisateur: InternalId;
  type: 'ouverture' | 'clic';
  tokenTracking: string;
  urlCible?: string;
  userAgent?: string;
  adresseIP?: string;
  dateEvenement: Date | string;
}
