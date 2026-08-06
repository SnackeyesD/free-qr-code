import type { AppEnv } from '../types/index.js';

export type D1Binding = import('@cloudflare/workers-types').D1Database;

export interface UserRow {
  id: number;
  public_id: string;
  email: string;
  mot_de_passe: string;
  nom: string;
  est_verifie: number;
  consentement_marketing: number;
  date_consentement_marketing: string | null;
  date_inscription: string;
  date_derniere_connexion: string | null;
  preferences: string | null;
  est_actif: number;
  role: 'utilisateur' | 'admin';
}

export interface RefreshTokenRow {
  id: number;
  id_utilisateur: number;
  token_hash: string;
  access_token_jti_hash: string | null;
  user_agent: string | null;
  adresse_ip: string | null;
  date_creation: string;
  date_derniere_utilisation: string | null;
  date_expiration: string;
  date_revocation: string | null;
  est_revoke: number;
}

export interface TokenEmailRow {
  id: number;
  id_utilisateur: number;
  token: string;
  type: string;
  est_utilise: number;
  date_creation: string;
  date_expiration: string;
}

export interface ApiKeyRow {
  id: number;
  public_id: string;
  id_utilisateur: number;
  nom: string;
  cle: string;
  permissions: string;
  date_creation: string;
  date_expiration: string | null;
  derniere_utilisation: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalQRCodeRow {
  id: number;
  public_id: string;
  id_qrcode: number;
  id_utilisateur: number;
  action: 'modification_cible' | 'activation' | 'desactivation' | 'suppression';
  ancienne_valeur: string | null;
  nouvelle_valeur: string | null;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface CampagneEmailRow {
  id: number;
  public_id: string;
  id_utilisateur: number;
  titre: string | null;
  contenu: string;
  cible: string;
  statut: string;
  date_envoi: string | null;
  date_creation: string;
  nombre_ouvertures: number;
  nombre_clics: number;
  created_at: string;
  updated_at: string;
}

export interface CampagneUtilisateurRow {
  id: number;
  id_campagne: number;
  id_utilisateur: number;
  date_envoi_utilisateur: string | null;
  est_ouvert: number;
  est_clique: number;
  created_at: string;
  updated_at: string;
}

export interface TrackingEmailRow {
  id: number;
  public_id: string;
  id_campagne: number;
  id_utilisateur: number;
  type: 'ouverture' | 'clic';
  token_tracking: string;
  url_cible: string | null;
  user_agent: string | null;
  adresse_ip: string | null;
  date_evenement: string;
  created_at: string;
  updated_at: string;
}

export interface ModeleRow {
  id: number;
  public_id: string;
  id_utilisateur: number | null;
  nom: string;
  description: string | null;
  type_contenu: string;
  parametres_par_defaut: string;
  est_public: number;
  date_creation: string;
  created_at: string;
  updated_at: string;
}

export function getD1(env: AppEnv['Bindings']): import('@cloudflare/workers-types').D1Database {
  const db = (env as Record<string, unknown>).DB as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) {
    throw new Error('Missing D1 binding "DB"');
  }
  return db;
}

export function nowDb(): string {
  return new Date().toISOString();
}

export function toBoolean(v: number): boolean {
  return v === 1;
}

export function fromBoolean(v: boolean): number {
  return v ? 1 : 0;
}
