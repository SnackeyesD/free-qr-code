import type { InternalId, PublicId } from './utilisateur.js';
import type { TypeContenuQR, QRCodeDesign } from './qrcode.js';

export interface ModeleQR {
  id: PublicId;
  idUtilisateur?: PublicId;
  nom: string;
  description?: string;
  typeContenu: TypeContenuQR;
  parametresParDefaut: QRCodeDesign;
  estPublic: boolean;
  dateCreation: Date | string;
}

export interface ModeleQRInternal {
  id: InternalId;
  idUtilisateur?: InternalId;
  nom: string;
  description?: string;
  typeContenu: TypeContenuQR;
  parametresParDefaut: QRCodeDesign;
  estPublic: boolean;
  dateCreation: Date | string;
}

export interface ModeleQRInput {
  nom: string;
  type: 'statique' | 'dynamique';
  contenu: string;
  estPublic: boolean;
  categorie?: string;
  typeContenu?: TypeContenuQR;
  parametresParDefaut?: QRCodeDesign;
}
