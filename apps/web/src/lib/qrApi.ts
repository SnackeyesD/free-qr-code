import type {
  QRCode,
  QRCodeInput,
  QRCodeUpdateInput,
  StatistiquesQRCode,
  PaginatedResult,
} from '@free-qr/shared-types';
import { api } from '@/lib/api';

export interface QRListFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: 'statique' | 'dynamique';
}

export interface QRStatsRange {
  from?: string;
  to?: string;
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

  downloadImage: async (id: string, format: 'png' | 'svg' = 'png'): Promise<Blob> => {
    const { data } = await api.get<Blob>(`/qrcodes/${id}/download?format=${format}`, {
      responseType: 'blob',
    });
    return data;
  },

  stats: async (id: string, range: QRStatsRange = {}): Promise<StatistiquesQRCode> => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    const query = params.toString() ? `?${params.toString()}` : '';
    const { data } = await api.get<StatistiquesQRCode>(`/qrcodes/${id}/stats${query}`);
    return data;
  },
};
