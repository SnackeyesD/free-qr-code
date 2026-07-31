import type {
  QRCode,
  QRCodeInput,
  QRCodeUpdateInput,
  StatistiquesQRCode,
  StatistiquesJournalieres,
  Scan,
  PaginatedResult,
} from '@free-qr/shared-types';
import { api } from '@/lib/api';

export interface QRListFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: 'statique' | 'dynamique';
}

export const qrApi = {
  list: async (filters: QRListFilters = {}): Promise<PaginatedResult<QRCode>> => {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.search) params.set('search', filters.search);
    if (filters.type) params.set('type', filters.type);
    const query = params.toString() ? `?${params.toString()}` : '';
    const { data } = await api.get<PaginatedResult<QRCode>>(`/qrcodes${query}`);
    return data;
  },

  getById: async (id: string): Promise<QRCode> => {
    const { data } = await api.get<QRCode>(`/qrcodes/${id}`);
    return data;
  },

  create: async (input: QRCodeInput): Promise<QRCode> => {
    const { data } = await api.post<QRCode>('/qrcodes', input);
    return data;
  },

  update: async (id: string, input: QRCodeUpdateInput): Promise<QRCode> => {
    const { data } = await api.patch<QRCode>(`/qrcodes/${id}`, input);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/qrcodes/${id}`);
  },

  downloadImage: async (id: string, format: 'png' | 'svg' | 'pdf' = 'png'): Promise<Blob> => {
    const { data } = await api.get<Blob>(`/qrcodes/${id}/download?format=${format}`, {
      responseType: 'blob',
    });
    return data;
  },

  stats: async (id: string, period: string = '7j'): Promise<StatistiquesQRCode> => {
    const { data } = await api.get<StatistiquesQRCode>(`/qrcodes/${id}/stats?periode=${period}`);
    return data;
  },

  dailyStats: async (id: string, start?: string, end?: string): Promise<StatistiquesJournalieres[]> => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const query = params.toString() ? `?${params.toString()}` : '';
    const { data } = await api.get<StatistiquesJournalieres[]>(`/qrcodes/${id}/stats/daily${query}`);
    return data;
  },

  recentScans: async (id: string, limit: number = 20): Promise<Scan[]> => {
    const { data } = await api.get<Scan[]>(`/qrcodes/${id}/scans?limit=${limit}`);
    return data;
  },
};
