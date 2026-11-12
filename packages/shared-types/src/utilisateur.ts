export type InternalId = number;
export type PublicId = string;
export type EntityId = InternalId | PublicId;

export type RoleUtilisateur = 'utilisateur' | 'admin';
export type PlanUtilisateur = 'gratuit' | 'pro';

export interface Utilisateur {
  id: PublicId;
  email: string;
  nom: string;
  estVerifie: boolean;
  consentementMarketing: boolean;
  dateConsentementMarketing?: Date | string;
  dateInscription: Date | string;
  dateDerniereConnexion?: Date | string;
  preferences?: UtilisateurPreferences;
  estActif: boolean;
  role: RoleUtilisateur;
  /** Plan commercial. Ne jamais consulter sur le chemin de redirection. */
  plan?: PlanUtilisateur;
  datePassagePro?: Date | string;
}

export interface UtilisateurInput {
  email: string;
  motDePasse: string;
  nom: string;
  consentementMarketing: boolean;
}

export interface UtilisateurPreferences {
  langue?: string;
  theme?: 'clair' | 'sombre' | 'systeme';
  notifications?: boolean;
  [key: string]: unknown;
}

export interface ProfilPublicUtilisateur {
  id: PublicId;
  email: string;
  nom: string;
  estVerifie: boolean;
  role: RoleUtilisateur;
  dateInscription: Date | string;
}
