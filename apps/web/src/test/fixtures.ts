import type {
  CampagneEmail,
  ModeleQR,
  QRCode,
  StatistiquesQRCode,
  Utilisateur,
} from '@free-qr/shared-types';
import { TEST_API_BASE as API_BASE } from './base';

export { API_BASE };

export function fakeUser(overrides: Partial<Utilisateur> = {}): Utilisateur {
  return {
    id: '1',
    email: 'test@example.com',
    nom: 'Test User',
    estVerifie: true,
    consentementMarketing: false,
    dateInscription: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    estActif: true,
    role: 'utilisateur',
    ...overrides,
  };
}

export function fakeQR(overrides: Partial<QRCode> = {}): QRCode {
  return {
    id: '1',
    idUtilisateur: '1',
    contenu: 'https://example.com',
    typeContenu: 'url',
    estDynamique: true,
    aliasCourt: 'abc1234',
    parametres: { couleur: '#000000', taille: 512 },
    estActif: true,
    dateCreation: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    nombreScansTotal: 0,
    ...overrides,
  };
}

export function fakeStats(overrides: Partial<StatistiquesQRCode> = {}): StatistiquesQRCode {
  return {
    idQrCode: '1',
    periode: { from: '2026-09-15', to: '2026-09-22' },
    totalScans: 10,
    scansUniques: 7,
    evolution: [
      { date: '2026-09-21', scans: 4, scansUniques: 3 },
      { date: '2026-09-22', scans: 6, scansUniques: 4 },
    ],
    pays: { France: 8 },
    appareils: { Desktop: 6 },
    ...overrides,
  };
}

export function fakeCampaign(overrides: Partial<CampagneEmail> = {}): CampagneEmail {
  return {
    id: '1',
    idUtilisateur: '1',
    nom: 'Campagne test',
    sujet: 'Sujet test',
    contenu: '<p>Hello</p>',
    corpsHtml: '<p>Hello</p>',
    cible: 'tous',
    statut: 'brouillon',
    nombreOuvertures: 0,
    nombreClics: 0,
    ...overrides,
  };
}

export function fakeTemplate(overrides: Partial<ModeleQR> = {}): ModeleQR {
  return {
    id: '1',
    nom: 'Modèle test',
    typeContenu: 'url',
    parametresParDefaut: { couleur: '#000000' },
    estPublic: true,
    dateCreation: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
  };
}
