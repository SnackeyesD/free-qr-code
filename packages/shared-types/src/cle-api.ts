import type { InternalId, PublicId } from './utilisateur.js';

export interface CleApi {
  id: PublicId;
  idUtilisateur: PublicId;
  nom: string;
  prefix?: string;
  cle?: string;
  permissions: string[];
  dateCreation: Date | string;
  dateExpiration?: Date | string;
  derniereUtilisation?: Date | string;
}

export interface CleApiInternal {
  id: InternalId;
  idUtilisateur: InternalId;
  nom: string;
  prefix?: string;
  cle?: string;
  permissions: string[];
  dateCreation: Date | string;
  dateExpiration?: Date | string;
  derniereUtilisation?: Date | string;
}

export interface CleApiInput {
  nom: string;
  dateExpiration?: Date | string;
  permissions?: string[];
}

export interface CleApiCreee extends CleApi {
  cle: string;
}

export type PermissionCleApi =
  | 'qrcodes:read'
  | 'qrcodes:create'
  | 'qrcodes:update'
  | 'qrcodes:delete'
  | 'stats:read'
  | 'admin:campaigns'
  | 'admin:templates';
