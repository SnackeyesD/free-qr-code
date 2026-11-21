import { api } from '@/lib/api';
import type { QRCode, TypeContenuQR } from '@free-qr/shared-types';

export interface RecentQRCode {
  id: number;
  nom: string;
  typeContenu: string;
  dateCreation: string;
  estActif: boolean;
  estDynamique: boolean;
}

export interface TopQRCode {
  id: number;
  nom: string;
  scansTotal: number;
  aliasCourt: string | null;
  estDynamique: boolean;
  dateCreation: string;
}

export interface DashboardStats {
  totalQRCodes: number;
  scans7j: number;
  scansUniques7j: number;
  totalScans: number;
  topQRcodes: TopQRCode[];
  recentQRCodes: RecentQRCode[];
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalQRCodes: number;
  totalScans7j: number;
  totalScans: number;
  topUsers: Array<{
    id: string;
    nom: string;
    email: string;
    qrCount: number;
    scanCount: number;
  }>;
  recentScans: Array<{
    dateScan: string;
    pays: string | null;
    appareil: string | null;
    aliasCourt: string | null;
  }>;
}

export function toQRCodeListItem(qr: RecentQRCode | TopQRCode): QRCode {
  const isRecent = 'typeContenu' in qr;
  return {
    id: String(qr.id),
    idUtilisateur: '',
    contenu: qr.nom,
    typeContenu: isRecent ? ((qr as RecentQRCode).typeContenu as TypeContenuQR) : 'url',
    estDynamique: qr.estDynamique,
    aliasCourt: 'aliasCourt' in qr ? ((qr as TopQRCode).aliasCourt ?? undefined) : undefined,
    parametres: {},
    estActif: isRecent ? (qr as RecentQRCode).estActif : true,
    dateCreation: qr.dateCreation,
    nombreScansTotal: 'scansTotal' in qr ? (qr as TopQRCode).scansTotal : 0,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/dashboard');
  return data;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const { data } = await api.get<AdminDashboardStats>('/admin/dashboard');
  return data;
}
