import type { InternalId, PublicId } from './utilisateur.js';

export interface Scan {
  id: PublicId;
  idQRCode: PublicId;
  adresseIP: string;
  userAgent?: string;
  pays?: string;
  ville?: string;
  referer?: string;
  dateScan: Date | string;
  estUnique: boolean;
}

export interface ScanInternal {
  id: InternalId;
  idQRCode: InternalId;
  adresseIP: string;
  userAgent?: string;
  pays?: string;
  ville?: string;
  referer?: string;
  dateScan: Date | string;
  estUnique: boolean;
}

export interface StatistiquesQRCode {
  idQrCode: PublicId;
  periode: string;
  totalScans: number;
  scansUniques: number;
  pays: Record<string, number>;
  appareils: Record<string, number>;
}

export interface StatistiquesJournalieres {
  id: PublicId;
  idQRCode: PublicId;
  date: Date | string;
  nombreScans: number;
  nombreScansUniques: number;
  paysTop?: Array<{ pays: string; count: number }>;
  appareilsTop?: Array<{ appareil: string; count: number }>;
}

export interface StatistiquesJournalieresInternal {
  id: InternalId;
  idQRCode: InternalId;
  date: Date | string;
  nombreScans: number;
  nombreScansUniques: number;
  paysTop?: Array<{ pays: string; count: number }>;
  appareilsTop?: Array<{ appareil: string; count: number }>;
}

export type FormatExport = 'csv' | 'xlsx' | 'json';
